-- 1. Restrict profiles reads
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_select_friends ON public.profiles
FOR SELECT TO authenticated
USING (public.are_friends(auth.uid(), id));

-- 2. Minimal public directory (safe columns only)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, username, display_name, avatar_url
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT ALL ON public.public_profiles TO service_role;

-- 3. Tighten SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chats_visible_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stories_visible_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.active_suspension() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recent_violation_count(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suspend_self(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_moderation_event(text, text, text[], text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, integer) FROM PUBLIC, anon;