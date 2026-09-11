CREATE TABLE public.image_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_library TO authenticated;
GRANT ALL ON public.image_library TO service_role;
ALTER TABLE public.image_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY image_library_all ON public.image_library FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX image_library_user_created_idx ON public.image_library (user_id, created_at DESC);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS chat_privacy boolean not null default false,
  ADD COLUMN IF NOT EXISTS hide_message_previews boolean not null default false;