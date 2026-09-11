import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, enforceRateLimit } from "@/lib/api-auth.server";
import { chunkDocument, embedTexts, retrievePassages } from "@/lib/rag.server";

type IngestBody = {
  action?: "ingest" | "search";
  documentId?: string;
  title?: string;
  source?: string;
  content?: string;
  question?: string;
};

const MAX_DOC_CHARS = 400_000;

export const Route = createFileRoute("/api/knowledge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const limited = await enforceRateLimit(auth.supabase, "rag_ingest", 300, 40);
        if (limited) return limited;

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing AI configuration", { status: 500 });

        const body = (await request.json()) as IngestBody;
        const { supabase, userId } = auth;

        // ---- Retrieval test: show which passages come back and whether they support an answer.
        if (body.action === "search") {
          const question = (body.question ?? "").trim();
          if (!question) return new Response("A question is required", { status: 400 });
          const passages = await retrievePassages(supabase, question, key, { matchCount: 6 });
          return Response.json({ passages });
        }

        // ---- Ingest / re-index a document.
        const content = (body.content ?? "").slice(0, MAX_DOC_CHARS);
        const title = (body.title ?? "Untitled").trim().slice(0, 200) || "Untitled";
        const source = (body.source ?? "paste").slice(0, 100);
        const chunks = chunkDocument(content);
        if (chunks.length === 0) return new Response("The document is empty", { status: 400 });

        let documentId = body.documentId;
        if (documentId) {
          // Updating an existing document: verify ownership, then drop the stale sections.
          const { data: owned } = await supabase
            .from("knowledge_documents")
            .select("id")
            .eq("id", documentId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!owned) return new Response("Forbidden", { status: 403 });

          await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
          const { error } = await supabase
            .from("knowledge_documents")
            .update({ title, source, content, status: "indexing", chunk_count: chunks.length })
            .eq("id", documentId);
          if (error) return new Response(error.message, { status: 400 });
        } else {
          const { data, error } = await supabase
            .from("knowledge_documents")
            .insert({
              user_id: userId,
              title,
              source,
              content,
              status: "indexing",
              chunk_count: chunks.length,
            })
            .select("id")
            .single();
          if (error || !data)
            return new Response(error?.message ?? "Could not save", { status: 400 });
          documentId = data.id;
        }

        try {
          const vectors = await embedTexts(
            chunks.map((chunk) => chunk.content),
            key,
          );
          const rows = chunks.map((chunk, i) => ({
            document_id: documentId!,
            user_id: userId,
            chunk_index: chunk.index,
            content: chunk.content,
            token_estimate: Math.ceil(chunk.content.length / 4),
            embedding: JSON.stringify(vectors[i]) as unknown as string,
          }));
          const { error } = await supabase.from("knowledge_chunks").insert(rows as never);
          if (error) throw new Error(error.message);

          await supabase
            .from("knowledge_documents")
            .update({ status: "ready", chunk_count: chunks.length })
            .eq("id", documentId);
        } catch (error) {
          await supabase
            .from("knowledge_documents")
            .update({ status: "failed" })
            .eq("id", documentId);
          return new Response(error instanceof Error ? error.message : "Indexing failed", {
            status: 500,
          });
        }

        return Response.json({ documentId, chunks: chunks.length });
      },
    },
  },
});
