import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  MessagesSquare,
  Moon,
  PanelLeft,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  User2,
  Users,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { AlaskaWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings-dialog";
import { useLanguage } from "@/lib/language";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Falls back to the first user message when the thread has no real title yet. */
function previewTitle(
  title: string | null,
  messages: { role: string; parts: unknown; created_at: string }[],
) {
  const placeholder = !title?.trim() || ["New chat", "Untitled chat", "Alaska"].includes(title);
  if (!placeholder) return title as string;

  const first = [...messages]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .find((m) => m.role === "user");
  const parts = Array.isArray(first?.parts)
    ? (first.parts as { type?: string; text?: string }[])
    : [];
  const text = parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join(" ")
    .trim();
  if (!text) return "Untitled chat";
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

const alaskaChat = [
  { key: "chat", to: "/chat", icon: MessageCircle },
  { key: "stories", to: "/stories", icon: Users },
  { key: "profile", to: "/profile", icon: User2 },
  { key: "privacy", to: "/privacy", icon: ShieldCheck },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (to: string) => location.pathname.startsWith(to);

  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_threads")
        .select("id, title, ai_messages(id, role, parts, created_at)")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      // Only surface threads that actually contain a conversation.
      return (data ?? [])
        .filter((t) => (t.ai_messages?.length ?? 0) > 0)
        .map((t) => ({ id: t.id, title: previewTitle(t.title, t.ai_messages ?? []) }));
    },
  });

  const startNewChat = async () => {
    setCreating(true);
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;
    if (!userId) {
      setCreating(false);
      return;
    }
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: userId, title: "New chat" })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Could not start a new chat");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
    navigate({ to: "/ai/$threadId", params: { threadId: data.id } });
  };

  if (collapsed) {
    return (
      <div className="p-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Show sidebar"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <Link to="/ai">
          <AlaskaWordmark />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide sidebar"
          onClick={() => setCollapsed(true)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>

      <nav className="mt-2 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div>
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("sidebar.previous")}
          </p>
          <button
            type="button"
            onClick={startNewChat}
            disabled={creating}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/60 disabled:opacity-60"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t("sidebar.newChat")}
          </button>
          <div className="space-y-1">
            {threads.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{t("sidebar.empty")}</p>
            ) : (
              threads.map((thread) => (
                <Link
                  key={thread.id}
                  to="/ai/$threadId"
                  params={{ threadId: thread.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    location.pathname === `/ai/${thread.id}`
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <MessagesSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{thread.title || "Untitled chat"}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("sidebar.alaskaChat")}
          </p>
          <div className="space-y-1">
            {alaskaChat.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={t(`sidebar.${item.key}`)}
                hint={t(`sidebar.${item.key}Hint`)}
                active={isActive(item.to)}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-between gap-1 border-t border-sidebar-border p-3">
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <SettingsDialog
          trigger={
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              {t("sidebar.settings")}
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("sidebar.signOut")}
        </Button>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  hint,
  active,
}: {
  to: string;
  icon: typeof MessageCircle;
  label: string;
  hint?: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </Link>
  );
}
