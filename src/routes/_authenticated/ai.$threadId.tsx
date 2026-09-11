import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useEffect } from "react";
import { AiChatWindow } from "@/components/ai-chat-window";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = useParams({ from: "/_authenticated/ai/$threadId" });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: async () => {
      const [thread, messages] = await Promise.all([
        supabase.from("ai_threads").select("id, title").eq("id", threadId).maybeSingle(),
        supabase
          .from("ai_messages")
          .select("id, client_id, role, parts")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
      ]);
      if (thread.error) throw thread.error;
      if (messages.error) throw messages.error;
      return {
        title: thread.data?.title ?? "New chat",
        messages: (messages.data ?? []).map((row) => ({
          id: row.client_id ?? row.id,
          role: row.role as UIMessage["role"],
          parts: row.parts as UIMessage["parts"],
        })) satisfies UIMessage[],
      };
    },
  });

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
    };
  }, [queryClient, threadId]);

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AiChatWindow
      key={threadId}
      threadId={threadId}
      initialMessages={data.messages}
      title={data.title}
    />
  );
}
