CREATE TABLE public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks select" ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "own blocks insert" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());
CREATE POLICY "own blocks delete" ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE TABLE public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  read_receipts boolean not null default true,
  last_seen boolean not null default true,
  disappearing boolean not null default false,
  enter_to_send boolean not null default true,
  message_sounds boolean not null default true,
  group_notifications boolean not null default true,
  story_notifications boolean not null default false,
  font_size text not null default 'medium',
  profile_photo_privacy text not null default 'friends',
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());