-- roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'moderator');
$$;

-- moderation events (input/output moderation log)
CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL DEFAULT 'ai_chat',
  direction text NOT NULL DEFAULT 'input',
  categories text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'low',
  action text NOT NULL DEFAULT 'allowed',
  excerpt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_events_user_time ON public.moderation_events (user_id, created_at DESC);
GRANT SELECT ON public.moderation_events TO authenticated;
GRANT ALL ON public.moderation_events TO service_role;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own moderation events" ON public.moderation_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator(auth.uid()));

-- abuse reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL DEFAULT 'user',
  target_id uuid,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report insert" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND char_length(reason) BETWEEN 1 AND 100 AND char_length(details) <= 2000);
CREATE POLICY "report select" ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_moderator(auth.uid()));
CREATE POLICY "report moderate" ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_moderator(auth.uid())) WITH CHECK (public.is_moderator(auth.uid()));

-- suspensions
CREATE TABLE IF NOT EXISTS public.account_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  suspended_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_suspensions_user ON public.account_suspensions (user_id, suspended_until DESC);
GRANT SELECT ON public.account_suspensions TO authenticated;
GRANT ALL ON public.account_suspensions TO service_role;
ALTER TABLE public.account_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suspensions" ON public.account_suspensions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator(auth.uid()));

-- rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);
GRANT SELECT ON public.rate_limit_counters TO authenticated;
GRANT ALL ON public.rate_limit_counters TO service_role;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own counters" ON public.rate_limit_counters FOR SELECT TO authenticated USING (user_id = auth.uid());

-- atomic counter bump, returns the new count in the window
CREATE OR REPLACE FUNCTION public.bump_rate_limit(_bucket text, _window_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _start timestamptz; _count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limit_counters (user_id, bucket, window_start, count)
  VALUES (_uid, _bucket, _start, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO _count;
  DELETE FROM public.rate_limit_counters WHERE user_id = _uid AND window_start < now() - interval '1 day';
  RETURN _count;
END; $$;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, integer) TO authenticated;

-- log a moderation event for the calling user
CREATE OR REPLACE FUNCTION public.log_moderation_event(
  _surface text, _direction text, _categories text[], _severity text, _action text, _excerpt text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.moderation_events (user_id, surface, direction, categories, severity, action, excerpt)
  VALUES (_uid, _surface, _direction, coalesce(_categories,'{}'), _severity, _action, left(coalesce(_excerpt,''), 500));
END; $$;
GRANT EXECUTE ON FUNCTION public.log_moderation_event(text, text, text[], text, text, text) TO authenticated;

-- repeated-harm counter + auto suspension check
CREATE OR REPLACE FUNCTION public.recent_violation_count(_hours integer DEFAULT 24)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.moderation_events
  WHERE user_id = auth.uid() AND action = 'blocked'
    AND created_at > now() - make_interval(hours => _hours);
$$;
GRANT EXECUTE ON FUNCTION public.recent_violation_count(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.active_suspension()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(suspended_until) FROM public.account_suspensions
  WHERE user_id = auth.uid() AND suspended_until > now();
$$;
GRANT EXECUTE ON FUNCTION public.active_suspension() TO authenticated;

CREATE OR REPLACE FUNCTION public.suspend_self(_hours integer, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.account_suspensions (user_id, reason, suspended_until)
  VALUES (_uid, left(coalesce(_reason,''),300), now() + make_interval(hours => greatest(_hours,1)));
END; $$;
GRANT EXECUTE ON FUNCTION public.suspend_self(integer, text) TO authenticated;

-- age-appropriate controls
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS safe_mode boolean NOT NULL DEFAULT true;