import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, FolderOpen, MessageCircle, Sparkles, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const HUB_LINKS = [
  {
    to: "/chat",
    label: "Chat",
    description: "Personal and group conversations with your friends",
    icon: MessageCircle,
  },
  {
    to: "/stories",
    label: "Stories",
    description: "Share research updates and watch what friends post",
    icon: Sparkles,
  },
  {
    to: "/profile",
    label: "Profile",
    description: "Your bio, location, privacy and app settings",
    icon: UserRound,
  },
] as const;

export function ProjectsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: threads = [] } = useQuery({
    queryKey: ["projects-threads"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Jump into a part of Alaska, or reopen one of your saved threads.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {HUB_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <link.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{link.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {link.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saved threads
          </p>
          <div className="max-h-[32vh] space-y-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No projects yet — start a chat and it shows up here.
              </p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/ai/$threadId", params: { threadId: thread.id } });
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{thread.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
