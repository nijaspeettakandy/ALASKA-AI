-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  chat_rules TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'light',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base TEXT; candidate TEXT; n INT := 0;
BEGIN
  base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user'), '[^a-z0-9_]', '', 'g'));
  IF base = '' THEN base := 'user'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1; candidate := base || n::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (NEW.id, candidate,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', candidate),
    NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FRIENDSHIPS
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b) OR (f.requester_id = _b AND f.addressee_id = _a))
  );
$$;

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.conversation_members, public.messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = _conversation_id AND m.user_id = _user_id);
$$;

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "members_select" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "members_insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "members_delete" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- STORIES
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE TABLE public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.stories, public.story_views TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_select" ON public.stories FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.are_friends(auth.uid(), author_id));
CREATE POLICY "stories_insert" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "stories_update" ON public.stories FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "stories_delete" ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "story_views_select" ON public.story_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- AI THREADS
CREATE TABLE public.ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  client_id TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_threads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_threads, public.ai_messages TO service_role;
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_threads_all" ON public.ai_threads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_messages_all" ON public.ai_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER ai_threads_updated_at BEFORE UPDATE ON public.ai_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_ai_messages_thread ON public.ai_messages(thread_id, created_at);
CREATE INDEX idx_stories_created ON public.stories(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;