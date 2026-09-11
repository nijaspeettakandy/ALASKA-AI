CREATE TABLE public.conversation_pins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_pins TO authenticated;
GRANT ALL ON public.conversation_pins TO service_role;
ALTER TABLE public.conversation_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pins" ON public.conversation_pins FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));