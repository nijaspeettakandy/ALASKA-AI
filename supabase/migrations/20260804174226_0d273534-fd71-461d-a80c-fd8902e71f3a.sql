REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon;