REVOKE EXECUTE ON FUNCTION public.are_friends(UUID, UUID) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;