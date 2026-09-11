import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 180;
const MAX_CHUNKS_PER_DOC = 400;

export type Chunk = { index: number; content: string };

/**
 * Split a document into clean, self-contained passages.
 * Paragraph boundaries are preferred; long paragraphs fall back to sentences
 * so a chunk never cuts a sentence in half. Overlap keeps context across seams.
 */
export function chunkDocument(raw: string): Chunk[] {
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return [];

  const blocks: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const clean = paragraph.trim();
    if (!clean) continue;
    if (clean.length <= MAX_CHUNK_CHARS) {
      blocks.push(clean);
      continue;
    }
    // Long paragraph: pack sentences until the limit.
    let buffer = "";
    for (const sentence of clean.match(/[^.!?\n]+[.!?]*\s*/g) ?? [clean]) {
      if (buffer.length + sentence.length > MAX_CHUNK_CHARS && buffer) {
        blocks.push(buffer.trim());
        buffer = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP_CHARS));
      }
      buffer += sentence;
    }
    if (buffer.trim()) blocks.push(buffer.trim());
  }

  // Merge tiny neighbours so passages stay meaningful.
  const merged: string[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (previous && previous.length + block.length + 2 <= MAX_CHUNK_CHARS) {
      merged[merged.length - 1] = `${previous}\n\n${block}`;
    } else {
      merged.push(block);
    }
  }

  return merged.slice(0, MAX_CHUNKS_PER_DOC).map((content, index) => ({ index, content }));
}

/** Embed a batch of passages through the Lovable AI gateway. */
export async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const vectors: number[][] = [];
  const BATCH = 64;

  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!response.ok) {
      throw new Error(`Embedding failed (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as {
      data?: { index: number; embedding: number[] }[];
    };
    const rows = [...(data.data ?? [])].sort((a, b) => a.index - b.index);
    if (rows.length !== batch.length) throw new Error("Embedding response was incomplete");
    for (const row of rows) vectors.push(row.embedding);
  }

  return vectors;
}

export type RetrievedPassage = {
  chunk_id: string;
  document_id: string;
  title: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

/**
 * Retrieve the passages most relevant to a question.
 * The SQL function filters on auth.uid(), so one user's documents can never
 * surface in another user's results.
 */
export async function retrievePassages(
  supabase: SupabaseClient<Database>,
  question: string,
  apiKey: string,
  options: { matchCount?: number; minSimilarity?: number } = {},
): Promise<RetrievedPassage[]> {
  const query = question.trim();
  if (!query) return [];

  // Retrieval is an enhancement: if embedding fails (outage, rate limit),
  // fall back to answering without knowledge-base context instead of failing the chat.
  let embedding: number[] | undefined;
  try {
    [embedding] = await embedTexts([query.slice(0, 4000)], apiKey);
  } catch {
    return [];
  }
  if (!embedding) return [];

  const { data, error } = await supabase.rpc(
    "match_knowledge_chunks" as never,
    {
      query_embedding: JSON.stringify(embedding),
      match_count: options.matchCount ?? 6,
      min_similarity: options.minSimilarity ?? 0.32,
    } as never,
  );
  if (error) return [];

  return (Array.isArray(data) ? data : []) as RetrievedPassage[];
}

/** Render retrieved passages as a numbered, citable context block. */
export function buildContextBlock(passages: RetrievedPassage[]): string {
  if (passages.length === 0) return "";
  const sources = passages
    .map(
      (passage, i) =>
        `[${i + 1}] ${passage.title} — section ${passage.chunk_index + 1} (relevance ${passage.similarity.toFixed(2)})\n${passage.content}`,
    )
    .join("\n\n");

  return (
    "\n\nKNOWLEDGE BASE PASSAGES retrieved from the user's own documents:\n" +
    `${sources}\n\n` +
    "Grounding rules: answer from these passages when they are relevant, and cite them inline as [1], [2] " +
    "right after the sentence they support. Never invent a citation number that is not listed above. " +
    "If the passages do not actually support an answer, say so plainly and answer from general knowledge " +
    "without citations, making clear it is not from their documents."
  );
}
