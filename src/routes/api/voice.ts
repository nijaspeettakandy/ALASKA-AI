import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { authenticateRequest, enforceRateLimit } from "@/lib/api-auth.server";
import { moderateText } from "@/lib/moderation.server";
import { getVoiceLanguage } from "@/lib/voice-languages";

type VoiceTurn = { role: "user" | "assistant"; content: string };
type VoiceRequestBody = { messages?: VoiceTurn[]; language?: string };

const SYSTEM_PROMPT =
  "You are Alaska AI in live voice mode. You are being listened to, not read: reply in short, natural spoken sentences " +
  "(usually 1-3 sentences), no markdown, no bullet lists, no emoji, no code blocks. Ask a brief follow-up when useful. " +
  "Refuse anything that enables serious harm, sexual content involving minors, harassment or hate, briefly and kindly.";

export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const limited = await enforceRateLimit(auth.supabase, "ai_voice", 300, 60);
        if (limited) return limited;

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing AI configuration", { status: 500 });

        const { messages, language } = (await request.json()) as VoiceRequestBody;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        const turns = messages
          .filter((turn) => turn && typeof turn.content === "string" && turn.content.trim())
          .slice(-12)
          .map((turn) => ({
            role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: turn.content.slice(0, 4000),
          }));

        const lastUser = [...turns].reverse().find((turn) => turn.role === "user");
        if (lastUser) {
          const verdict = await moderateText(lastUser.content, { apiKey: key, safeMode: true });
          if (!verdict.allowed) {
            return Response.json({
              text:
                verdict.reason ||
                "I can't help with that one — it breaks Alaska's safety rules. Try asking something else.",
            });
          }
        }

        const spoken = getVoiceLanguage(typeof language === "string" ? language : "en");
        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system: `${SYSTEM_PROMPT} Always answer in ${spoken.label} (${spoken.locale}), whatever language the user speaks.`,
          messages: turns,
        });

        const text = await result.text;
        return Response.json({ text });
      },
    },
  },
});
