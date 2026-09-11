import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pin, PinOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FriendsDialog } from "@/components/friends-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

type ConversationRow = {
  id: string;
  title: string | null;
  is_group: boolean;
  last_message_at: string;
  pinned: boolean;
  preview: string | null;
  displayName: string;
  avatarUrl: string | null;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function ChatLayout() {
  const params = useParams({ strict: false }) as { conversationId?: string };
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, is_group, last_message_at")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [] as ConversationRow[];

      const ids = rows.map((r) => r.id);
      const { data: authUser } = await supabase.auth.getUser();
      const me = authUser.user?.id ?? null;
      const [{ data: messages }, { data: pins }, { data: members }] = await Promise.all([
        supabase
          .from("messages")
          .select("conversation_id, body, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("conversation_pins").select("conversation_id"),
        supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", ids),
      ]);

      // Resolve the other participant so 1:1 chats show a real name and avatar.
      const otherByConversation = new Map<string, string>();
      for (const m of members ?? []) {
        if (m.user_id !== me && !otherByConversation.has(m.conversation_id)) {
          otherByConversation.set(m.conversation_id, m.user_id);
        }
      }
      const otherIds = [...new Set(otherByConversation.values())];
      const profiles = otherIds.length
        ? ((
            await supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url")
              .in("id", otherIds)
          ).data ?? [])
        : [];
      const profileById = new Map(profiles.map((p) => [p.id, p]));

      const latest = new Map<string, string>();
      for (const m of messages ?? []) {
        if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m.body);
      }
      const pinned = new Set((pins ?? []).map((p) => p.conversation_id));

      return rows
        .map((r) => {
          const other = profileById.get(otherByConversation.get(r.id) ?? "");
          const displayName = r.is_group
            ? r.title || "Group"
            : other?.display_name || other?.username || r.title || "Direct chat";
          return {
            ...r,
            pinned: pinned.has(r.id),
            preview: latest.get(r.id) ?? null,
            displayName,
            avatarUrl: r.is_group ? null : (other?.avatar_url ?? null),
          };
        })
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.last_message_at.localeCompare(a.last_message_at);
        }) as ConversationRow[];
    },
  });

  const togglePin = async (conversation: ConversationRow) => {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;
    if (!userId) return;
    const { error } = conversation.pinned
      ? await supabase
          .from("conversation_pins")
          .delete()
          .eq("conversation_id", conversation.id)
          .eq("user_id", userId)
      : await supabase
          .from("conversation_pins")
          .insert({ conversation_id: conversation.id, user_id: userId });
    if (error) {
      toast.error("Could not update pin");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const hasConversations = conversations.length > 0;

  if (!hasConversations) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 text-center">
        <MessageCircle className="h-10 w-10 text-primary" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Alaska Chat</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            No conversations yet. Find friends by username — once they accept, you can chat.
          </p>
        </div>
        <FriendsDialog variant="cta" label="Chat with friends" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <h1 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Chats
          </h1>
          <FriendsDialog label="Friends" />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                params.conversationId === conversation.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
            >
              <Link
                to="/chat/$conversationId"
                params={{ conversationId: conversation.id }}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
              >
                <Avatar className="h-9 w-9">
                  {conversation.avatarUrl ? (
                    <AvatarImage src={conversation.avatarUrl} alt={conversation.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {conversation.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {conversation.pinned ? <Pin className="h-3 w-3 shrink-0 text-primary" /> : null}
                    <p className="truncate text-sm font-medium">{conversation.displayName}</p>

                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(conversation.last_message_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.preview ?? (conversation.is_group ? "Group" : "No messages yet")}
                  </p>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
                className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => togglePin(conversation)}
              >
                {conversation.pinned ? (
                  <PinOff className="h-3.5 w-3.5" />
                ) : (
                  <Pin className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
