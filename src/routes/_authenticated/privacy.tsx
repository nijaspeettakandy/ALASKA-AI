import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Database, Eye, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & data controls — Alaska AI" },
      {
        name: "description",
        content:
          "See exactly what Alaska AI stores about you, control who can see your chats and stories, and delete your account.",
      },
      { property: "og:title", content: "Privacy & data controls — Alaska AI" },
      {
        property: "og:description",
        content:
          "Review stored data, toggle chat and story visibility, and permanently delete your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

type Counts = {
  threads: number;
  aiMessages: number;
  conversations: number;
  messages: number;
  stories: number;
  images: number;
  media: number;
  friends: number;
};

function PrivacyPage() {
  const queryClient = useQueryClient();
  const runDelete = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: userId } = useQuery({
    queryKey: ["privacy-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: settings } = useQuery({
    enabled: !!userId,
    queryKey: ["privacy-settings", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("chats_visible, stories_visible, last_seen, read_receipts, chat_privacy")
        .eq("user_id", userId!)
        .maybeSingle();
      return (
        data ?? {
          chats_visible: true,
          stories_visible: true,
          last_seen: true,
          read_receipts: true,
          chat_privacy: false,
        }
      );
    },
  });

  const { data: counts } = useQuery({
    enabled: !!userId,
    queryKey: ["privacy-counts", userId],
    queryFn: async (): Promise<Counts> => {
      const head = { count: "exact" as const, head: true };
      const [threads, aiMessages, members, messages, stories, images, friends] = await Promise.all([
        supabase.from("ai_threads").select("id", head).eq("user_id", userId!),
        supabase.from("ai_messages").select("id", head).eq("user_id", userId!),
        supabase.from("conversation_members").select("user_id", head).eq("user_id", userId!),
        supabase.from("messages").select("id", head).eq("sender_id", userId!),
        supabase.from("stories").select("id", head).eq("author_id", userId!),
        supabase.from("image_library").select("id", head).eq("user_id", userId!),
        supabase.from("friendships").select("id", head).eq("status", "accepted"),
      ]);
      const media = await supabase.storage.from("media").list(userId!, { limit: 1000 });
      return {
        threads: threads.count ?? 0,
        aiMessages: aiMessages.count ?? 0,
        conversations: members.count ?? 0,
        messages: messages.count ?? 0,
        stories: stories.count ?? 0,
        images: images.count ?? 0,
        media: media.data?.length ?? 0,
        friends: friends.count ?? 0,
      };
    },
  });

  const update = async (patch: Record<string, boolean>) => {
    if (!userId) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["privacy-settings", userId] });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Privacy updated");
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await runDelete({ data: undefined });
      await supabase.auth.signOut();
      toast.success("Your account and all data were deleted");
      window.location.href = "/";
    } catch (error) {
      setDeleting(false);
      toast.error(error instanceof Error ? error.message : "Could not delete your account");
    }
  };

  const stored: Array<[string, string, number | undefined]> = [
    ["Alaska AI threads", "Your saved AI conversations", counts?.threads],
    ["Alaska AI messages", "Prompts and replies inside those threads", counts?.aiMessages],
    ["Chats", "Direct and group conversations you're part of", counts?.conversations],
    ["Messages sent", "Messages you wrote in those chats", counts?.messages],
    ["Stories", "Research updates you posted", counts?.stories],
    ["Saved images", "Images kept in your image library", counts?.images],
    ["Uploaded files", "Photos and documents in your private media folder", counts?.media],
    ["Friends", "Accepted friend connections", counts?.friends],
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Privacy &amp; data controls
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything Alaska AI stores about you, and who gets to see it.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-primary" /> Data stored on your account
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stored.map(([label, hint, value]) => (
            <div key={label} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{label}</p>
                <span className="text-sm tabular-nums text-primary">
                  {value === undefined ? "—" : value}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Stored securely in your Alaska AI backend and readable only by you — protected by
          row-level security. Download a full copy from Settings → Data controls → Export.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4 text-primary" /> Visibility
        </h2>
        <div className="divide-y divide-border/60">
          <Toggle
            label="Chats visible to friends"
            hint="When off, nobody else can add you to new direct chats or groups."
            checked={settings?.chats_visible ?? true}
            onChange={(v) => update({ chats_visible: v })}
          />
          <Toggle
            label="Stories visible to friends"
            hint="When off, your stories stay private — only you can see them."
            checked={settings?.stories_visible ?? true}
            onChange={(v) => update({ stories_visible: v })}
          />
          <Toggle
            label="Show last seen"
            hint="Let friends see when you were last active."
            checked={settings?.last_seen ?? true}
            onChange={(v) => update({ last_seen: v })}
          />
          <Toggle
            label="Read receipts"
            hint="Let friends know when you've read their messages."
            checked={settings?.read_receipts ?? true}
            onChange={(v) => update({ read_receipts: v })}
          />
          <Toggle
            label="Blur chats on screen"
            hint="Hides chat content until you hover, for privacy in public."
            checked={settings?.chat_privacy ?? false}
            onChange={(v) => update({ chat_privacy: v })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Delete account
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your profile, Alaska AI threads and messages, chats and messages you
          sent, stories, saved images and every uploaded file. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="mt-4 gap-2">
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                Type <strong>DELETE</strong> to confirm. Your account and all associated data will
                be erased immediately and cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirm !== "DELETE" || deleting}
                onClick={(e) => {
                  e.preventDefault();
                  void onDelete();
                }}
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <p className="text-xs text-muted-foreground">
        Looking for more options?{" "}
        <Link to="/profile" className="underline">
          Profile &amp; settings
        </Link>
      </p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
