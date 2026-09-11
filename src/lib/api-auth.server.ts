import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthedRequest = {
  userId: string;
  supabase: SupabaseClient<Database>;
};

/**
 * Verifies the caller's bearer token with the auth server and returns a
 * Supabase client scoped to that user (RLS applies as that user).
 * Never trust the presence of a token alone.
 */
export async function authenticateRequest(request: Request): Promise<AuthedRequest | Response> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return new Response("Unauthorized", { status: 401 });

  const url = process.env["SUPABASE_URL"];
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishable) return new Response("Missing backend configuration", { status: 500 });

  const supabase = createClient<Database>(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  const userId = data.user?.id;
  if (error || !userId) return new Response("Unauthorized", { status: 401 });

  return { userId, supabase };
}

/** Rolling per-account rate limit. Returns a 429 Response when exceeded. */
export async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: string,
  windowSeconds: number,
  max: number,
): Promise<Response | null> {
  const { data } = await supabase.rpc(
    "bump_rate_limit" as never,
    {
      _bucket: bucket,
      _window_seconds: windowSeconds,
    } as never,
  );
  if (typeof data === "number" && data > max) {
    return new Response("Too many requests. Please slow down and try again shortly.", {
      status: 429,
    });
  }
  return null;
}

/** Confirms the signed-in user owns the AI thread before it is written to. */
export async function assertThreadOwner(
  supabase: SupabaseClient<Database>,
  threadId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("ai_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
