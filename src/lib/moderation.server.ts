import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ModerationVerdict = {
  allowed: boolean;
  severity: "none" | "low" | "medium" | "high";
  categories: string[];
  reason: string;
};

const CATEGORY_LIST = [
  "sexual_content",
  "sexual_minors",
  "violence",
  "self_harm",
  "harassment",
  "hate",
  "illegal_activity",
  "weapons_explosives",
  "drugs",
  "dangerous_instructions",
  "privacy_doxxing",
  "malware",
];

const MODERATION_PROMPT = (
  safeMode: boolean,
) => `You are a content-safety classifier for a consumer chat app.
Classify the CONTENT below. Categories: ${CATEGORY_LIST.join(", ")}.
Severity: none, low, medium, high.
Block (allowed=false) anything sexual involving minors, instructions that enable serious harm
(weapons, explosives, malware, drug synthesis, self-harm methods), targeted harassment or hate,
doxxing, or explicit sexual content.${
  safeMode
    ? " SAFE MODE IS ON: also block sexual content, graphic violence, gambling, and drug or alcohol promotion."
    : ""
}
Do not block legitimate research, medical, historical, security-awareness or fiction discussion.
Reply with ONLY compact JSON: {"allowed":boolean,"severity":"none|low|medium|high","categories":[string],"reason":"short user-facing explanation"}`;

const SAFE_FALLBACK: ModerationVerdict = {
  allowed: true,
  severity: "none",
  categories: [],
  reason: "",
};

/** Classify a piece of text with the Lovable AI gateway. Fails open on infrastructure errors. */
export async function moderateText(
  text: string,
  options: { apiKey: string; safeMode: boolean },
): Promise<ModerationVerdict> {
  const content = text.trim();
  if (!content) return SAFE_FALLBACK;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          { role: "system", content: MODERATION_PROMPT(options.safeMode) },
          { role: "user", content: `CONTENT:\n${content.slice(0, 6000)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return SAFE_FALLBACK;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(
      raw.replace(/^```json\s*|```$/g, "").trim(),
    ) as Partial<ModerationVerdict>;

    return {
      allowed: parsed.allowed !== false,
      severity: (parsed.severity as ModerationVerdict["severity"]) ?? "none",
      categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 6).map(String) : [],
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
    };
  } catch {
    return SAFE_FALLBACK;
  }
}

type Client = SupabaseClient<Database>;

/** Log a moderation decision against the calling user. */
export async function logModeration(
  supabase: Client,
  args: {
    direction: "input" | "output";
    surface?: string;
    verdict: ModerationVerdict;
    action: "allowed" | "blocked";
    excerpt: string;
  },
) {
  await supabase.rpc(
    "log_moderation_event" as never,
    {
      _surface: args.surface ?? "ai_chat",
      _direction: args.direction,
      _categories: args.verdict.categories,
      _severity: args.verdict.severity,
      _action: args.action,
      _excerpt: args.excerpt.slice(0, 500),
    } as never,
  );
}

/** Increment a per-user window counter. Returns the new count (0 when unavailable). */
export async function bumpRateLimit(supabase: Client, bucket: string, windowSeconds: number) {
  const { data } = await supabase.rpc(
    "bump_rate_limit" as never,
    {
      _bucket: bucket,
      _window_seconds: windowSeconds,
    } as never,
  );
  return typeof data === "number" ? data : 0;
}

/** Blocked-request count in the last N hours for the calling user. */
export async function recentViolations(supabase: Client, hours = 24) {
  const { data } = await supabase.rpc(
    "recent_violation_count" as never,
    { _hours: hours } as never,
  );
  return typeof data === "number" ? data : 0;
}

/** Active suspension end time for the calling user, or null. */
export async function activeSuspension(supabase: Client) {
  const { data } = await supabase.rpc("active_suspension" as never);
  return typeof data === "string" ? data : null;
}

export async function suspendSelf(supabase: Client, hours: number, reason: string) {
  await supabase.rpc("suspend_self" as never, { _hours: hours, _reason: reason } as never);
}

export const textFromParts = (parts: unknown): string =>
  Array.isArray(parts)
    ? parts
        .filter(
          (part): part is { type: string; text: string } =>
            typeof part === "object" &&
            part !== null &&
            (part as { type?: string }).type === "text" &&
            typeof (part as { text?: string }).text === "string",
        )
        .map((part) => part.text)
        .join("\n")
    : "";
