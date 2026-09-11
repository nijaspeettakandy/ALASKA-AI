import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, enforceRateLimit } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const limited = await enforceRateLimit(auth.supabase, "transcribe", 300, 60);
        if (limited) return limited;

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing AI configuration", { status: 500 });

        const incoming = await request.formData();
        const file = incoming.get("file");
        if (!(file instanceof File)) return new Response("Audio file required", { status: 400 });

        const body = new FormData();
        body.append("file", file, file.name || "audio.webm");
        body.append("model", "openai/gpt-4o-mini-transcribe");
        const language = incoming.get("language");
        if (typeof language === "string" && /^[a-z]{2}$/.test(language)) {
          body.append("language", language);
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return new Response(detail || "Transcription failed", { status: response.status });
        }

        const data = (await response.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
