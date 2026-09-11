import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Phone, Send, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/emoji-picker";
import { Input } from "@/components/ui/input";
import { ReportDialog, type ReportTarget } from "@/components/report-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  component: ConversationPage,
});

type MessageRow = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

function ConversationPage() {
  const { conversationId } = useParams({ from: "/_authenticated/chat/$conversationId" });
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, is_group")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as MessageRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const { data: otherMember } = useQuery({
    queryKey: ["conversation-other", conversationId, me],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const otherId = (data ?? []).find((row) => row.user_id !== me)?.user_id ?? null;
      if (!otherId) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      return { id: otherId, profile };
    },
  });

  const isGroup = conversation?.is_group ?? false;
  const headerName = isGroup
    ? conversation?.title || "Group"
    : otherMember?.profile?.display_name ||
      otherMember?.profile?.username ||
      conversation?.title ||
      "Conversation";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const text = body.trim();
    if (!text || !me) return;

    // Rate limit: 30 messages per minute per account.
    const { data: used } = await supabase.rpc(
      "bump_rate_limit" as never,
      {
        _bucket: "direct_messages",
        _window_seconds: 60,
      } as never,
    );
    if (typeof used === "number" && used > 30) {
      toast.error("You're sending messages too quickly. Take a short break.");
      return;
    }

    setBody("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body: text });
    if (error) {
      toast.error("Message not sent");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {otherMember?.profile?.avatar_url ? (
              <AvatarImage src={otherMember.profile.avatar_url} alt={headerName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {headerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{headerName}</p>
            <p className="text-xs text-muted-foreground">
              {isGroup ? "Group chat" : "Personal chat"}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toast("Voice calling is coming soon")}
            aria-label="Voice call"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toast("Video calling is coming soon")}
            aria-label="Video call"
          >
            <Video className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Report this chat"
            onClick={() =>
              setReport({
                type: "user",
                userId: otherMember?.id ?? undefined,
                id: conversationId,
                label: "this chat",
              })
            }
          >
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Say hello 👋</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === me;
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-soft",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card text-card-foreground",
                  )}
                >
                  {message.body}
                  {!mine ? (
                    <button
                      type="button"
                      className="mt-1 block text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() =>
                        setReport({
                          type: "message",
                          id: message.id,
                          userId: message.sender_id,
                          label: "this message",
                        })
                      }
                    >
                      Report
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <EmojiPicker onSelect={(emoji) => setBody((current) => `${current}${emoji}`)} />
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a message…"
        />
        <Button type="submit" size="icon" disabled={!body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {report ? (
        <ReportDialog open onOpenChange={(open) => !open && setReport(null)} target={report} />
      ) : null}
    </div>
  );
}
