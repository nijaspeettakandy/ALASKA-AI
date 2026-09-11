import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  activeSuspension,
  bumpRateLimit,
  logModeration,
  moderateText,
  recentViolations,
  suspendSelf,
  textFromParts,
} from "@/lib/moderation.server";
import { assertThreadOwner } from "@/lib/api-auth.server";
import { buildContextBlock, retrievePassages } from "@/lib/rag.server";
import { getVoiceLanguage } from "@/lib/voice-languages";
import type { Database } from "@/integrations/supabase/types";

type ChatRequestBody = {
  messages?: unknown;
  threadId?: string;
  incognito?: boolean;
  language?: string;
};

/** Requests allowed per user per rolling window. */
const RATE_LIMIT = { bucket: "ai_chat", windowSeconds: 300, max: 40 };
/** Blocked requests in 24h before the account is auto-suspended. */
const VIOLATION_LIMIT = 5;
const SUSPENSION_HOURS = 24;

const SYSTEM_PROMPT =
  "You are Alaska AI, a warm, sharp research companion. Answer clearly, use markdown, and keep answers tight unless depth is asked for. " +
  "Safety rules you never break: refuse instructions that enable serious harm (weapons, explosives, malware, drug synthesis, self-harm methods), " +
  "refuse sexual content involving minors and explicit sexual content, refuse harassment, hate speech and doxxing. " +
  "When you refuse, be brief and kind, and point to safer help (e.g. crisis support) when someone may be at risk.";

const SAFE_MODE_PROMPT =
  " The user is in safe mode (age-appropriate): also avoid sexual content, graphic violence, gambling, and drug or alcohol promotion; keep language clean.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { messages, threadId, incognito, language } =
          (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) return new Response("Messages are required", { status: 400 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing AI configuration", { status: 500 });

        const supabase = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData } = await supabase.auth.getUser(token);
        const userId = userData.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        // Every write below targets a thread the caller must own.
        if (threadId && !incognito && !(await assertThreadOwner(supabase, threadId, userId))) {
          return new Response("Forbidden", { status: 403 });
        }

        const uiMessages = messages as UIMessage[];
        const lastMessage = uiMessages[uiMessages.length - 1];

        // 1. Account suspension
        const suspendedUntil = await activeSuspension(supabase);
        if (suspendedUntil) {
          return new Response(
            `Your account is suspended until ${new Date(suspendedUntil).toLocaleString()} after repeated safety violations.`,
            { status: 403 },
          );
        }

        // 2. Rate limiting
        const used = await bumpRateLimit(supabase, RATE_LIMIT.bucket, RATE_LIMIT.windowSeconds);
        if (used > RATE_LIMIT.max) {
          return new Response("You're sending messages too quickly. Please wait a few minutes.", {
            status: 429,
          });
        }

        // Age-appropriate controls
        const [{ data: profile }, { data: priv }] = await Promise.all([
          supabase.from("profiles").select("safe_mode").eq("id", userId).maybeSingle(),
          supabase.from("profile_private").select("birth_year").eq("user_id", userId).maybeSingle(),
        ]);
        const age = priv?.birth_year ? new Date().getFullYear() - priv.birth_year : null;
        const safeMode = profile?.safe_mode !== false || (age !== null && age < 18);

        // 3. Input moderation
        const userText = textFromParts(lastMessage?.parts);
        if (lastMessage?.role === "user" && userText.trim()) {
          const verdict = await moderateText(userText, { apiKey: key, safeMode });
          if (!verdict.allowed) {
            await logModeration(supabase, {
              direction: "input",
              verdict,
              action: "blocked",
              excerpt: userText,
            });

            // 4. Monitoring for repeated harmful requests → auto suspension
            const violations = await recentViolations(supabase, 24);
            if (violations >= VIOLATION_LIMIT) {
              await suspendSelf(supabase, SUSPENSION_HOURS, "Repeated harmful requests");
              return new Response(
                "Your account has been suspended for 24 hours after repeated requests that break our safety rules.",
                { status: 403 },
              );
            }

            return new Response(
              verdict.reason ||
                "I can't help with that — it breaks Alaska's safety rules. Try rephrasing your question.",
              { status: 422 },
            );
          }
          if (verdict.severity === "medium" || verdict.severity === "high") {
            await logModeration(supabase, {
              direction: "input",
              verdict,
              action: "allowed",
              excerpt: userText,
            });
          }
        }

        if (threadId && !incognito && lastMessage?.role === "user") {
          await supabase.from("ai_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            client_id: lastMessage.id,
            parts: lastMessage.parts as never,
          });

          // Give the thread a real title based on the first user message.
          const { data: thread } = await supabase
            .from("ai_threads")
            .select("title")
            .eq("id", threadId)
            .maybeSingle();
          const placeholder = !thread?.title || ["New chat", "Alaska"].includes(thread.title);
          if (placeholder && userText.trim()) {
            await supabase
              .from("ai_threads")
              .update({ title: userText.trim().slice(0, 60) })
              .eq("id", threadId);
          }
        }

        // Retrieval-augmented context from the caller's own knowledge base only.
        const passages = userText.trim()
          ? await retrievePassages(supabase, userText, key, { matchCount: 6 })
          : [];

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-2.5-flash"),
          system:
            SYSTEM_PROMPT +
            (safeMode ? SAFE_MODE_PROMPT : "") +
            ` Always reply in ${getVoiceLanguage(typeof language === "string" ? language : "en").label}, whatever language the user writes in.` +
            buildContextBlock(passages),
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            if (!responseMessage) return;

            // 5. Output moderation
            const answer = textFromParts(responseMessage.parts);
            const verdict = answer.trim()
              ? await moderateText(answer, { apiKey: key, safeMode })
              : null;
            const unsafeOutput = verdict ? !verdict.allowed : false;
            if (verdict && (unsafeOutput || verdict.severity === "high")) {
              await logModeration(supabase, {
                direction: "output",
                verdict,
                action: unsafeOutput ? "blocked" : "allowed",
                excerpt: answer,
              });
            }

            if (!threadId || incognito) return;
            await supabase.from("ai_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              client_id: responseMessage.id,
              parts: unsafeOutput
                ? ([
                    { type: "text", text: "[This reply was removed by Alaska's safety filter.]" },
                  ] as never)
                : (responseMessage.parts as never),
            });
            await supabase
              .from("ai_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
