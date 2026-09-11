import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: ResumeConversation,
});

function ResumeConversation() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      // Reuse the latest thread only if it's still empty, so the app always
      // opens on the "What's on the agenda?" screen.
      const { data: existing } = await supabase
        .from("ai_threads")
        .select("id, ai_messages(id)")
        .order("updated_at", { ascending: false })
        .limit(1);

      const latest = existing?.[0];
      if (latest && (latest.ai_messages?.length ?? 0) === 0) {
        navigate({ to: "/ai/$threadId", params: { threadId: latest.id }, replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("ai_threads")
        .insert({ user_id: userId, title: "Alaska" })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Could not open your conversation");
        return;
      }
      navigate({ to: "/ai/$threadId", params: { threadId: data.id }, replace: true });
    })();
  }, [navigate]);

  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}
