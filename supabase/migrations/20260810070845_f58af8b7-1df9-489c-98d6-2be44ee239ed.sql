-- Private profile fields
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT '',
  birth_year integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_private_own ON public.profile_private
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

INSERT INTO public.profile_private (user_id, location, birth_year)
SELECT id, coalesce(location, ''), birth_year FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS location;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birth_year;

-- Remove the definer view; base-table policies handle visibility now
DROP VIEW IF EXISTS public.public_profiles;

DROP POLICY IF EXISTS profiles_select_friends ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

CREATE POLICY profiles_select_authenticated ON public.profiles
FOR SELECT TO authenticated
USING (true);