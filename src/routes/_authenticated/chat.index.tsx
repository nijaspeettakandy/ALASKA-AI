import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { FriendsDialog } from "@/components/friends-dialog";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: EmptyChat,
});

function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <MessageCircle className="h-10 w-10 text-primary" />
      <h1 className="text-lg font-semibold">Alaska Chat</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pick a conversation on the left, or find a friend by username to start chatting.
      </p>
      <FriendsDialog variant="cta" label="Chat with friends" />
    </div>
  );
}
