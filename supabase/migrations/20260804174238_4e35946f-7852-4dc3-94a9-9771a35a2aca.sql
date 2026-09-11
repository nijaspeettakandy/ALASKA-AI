REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;