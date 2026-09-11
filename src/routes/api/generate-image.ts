import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, enforceRateLimit } from "@/lib/api-auth.server";

type Body = {
  prompt?: string;
  quality?: "fast" | "high";
  aspect?: string;
  referenceImage?: string;
  variation?: boolean;
};

const ASPECT_HINTS: Record<string, string> = {
  square: "Compose it as a square 1:1 image.",
  landscape: "Compose it as a wide 16:9 landscape image.",
  portrait: "Compose it as a tall 9:16 portrait image.",
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const limited = await enforceRateLimit(auth.supabase, "image_generation", 600, 20);
        if (limited) return limited;

        const { prompt, quality, aspect, referenceImage, variation } =
          (await request.json()) as Body;
        if (!prompt?.trim() && !referenceImage) {
          return new Response("Prompt is required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing AI configuration", { status: 500 });

        const directives = [
          prompt?.trim() ?? "",
          ASPECT_HINTS[aspect ?? "square"] ?? "",
          quality === "high"
            ? "Render with high detail, accurate lighting, crisp focus and no visual artifacts."
            : "",
          variation
            ? "Create a fresh variation of the reference image: keep the subject and overall intent, but change composition, lighting, palette and mood."
            : referenceImage
              ? "Use the reference image as the visual starting point."
              : "",
          "Never render watermarks or unreadable text.",
        ]
          .filter(Boolean)
          .join(" ");

        const content = referenceImage
          ? [
              { type: "text", text: directives },
              { type: "image_url", image_url: { url: referenceImage } },
            ]
          : directives;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model:
              quality === "high" ? "google/gemini-3-pro-image" : "google/gemini-3.1-flash-image",
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
