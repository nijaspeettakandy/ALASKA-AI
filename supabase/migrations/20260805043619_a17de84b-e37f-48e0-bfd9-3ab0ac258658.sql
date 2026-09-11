ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS stories_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chats_visible boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.stories_visible_for(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT s.stories_visible FROM public.user_settings s WHERE s.user_id = _user_id), true);
$$;

CREATE OR REPLACE FUNCTION public.chats_visible_for(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT s.chats_visible FROM public.user_settings s WHERE s.user_id = _user_id), true);
$$;

REVOKE EXECUTE ON FUNCTION public.stories_visible_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.chats_visible_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stories_visible_for(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chats_visible_for(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR (public.are_friends(auth.uid(), author_id) AND public.stories_visible_for(author_id))
  );

DROP POLICY IF EXISTS "members_insert" ON public.conversation_members;
CREATE POLICY "members_insert" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (
      public.chats_visible_for(user_id)
      AND (
        public.is_conversation_member(conversation_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = conversation_members.conversation_id AND c.created_by = auth.uid()
        )
      )
    )
  );