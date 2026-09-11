import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Database,
  Flag,
  ShieldAlert,
  Keyboard,
  Loader2,
  Lock,
  MessageSquare,
  Moon,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { ReportDialog } from "@/components/report-dialog";

type Settings = {
  read_receipts: boolean;
  last_seen: boolean;
  disappearing: boolean;
  enter_to_send: boolean;
  message_sounds: boolean;
  group_notifications: boolean;
  story_notifications: boolean;
  font_size: string;
  profile_photo_privacy: string;
  chat_privacy: boolean;
  hide_message_previews: boolean;
};

const DEFAULTS: Settings = {
  read_receipts: true,
  last_seen: true,
  disappearing: false,
  enter_to_send: true,
  message_sounds: true,
  group_notifications: true,
  story_notifications: false,
  font_size: "medium",
  profile_photo_privacy: "friends",
  chat_privacy: false,
  hide_message_previews: false,
};

const SHORTCUTS: Array<[string, string]> = [
  ["New chat", "Ctrl + N"],
  ["Search", "Ctrl + K"],
  ["Next chat", "Ctrl + Tab"],
  ["New story", "Ctrl + Shift + S"],
  ["Ask Alaska AI", "Ctrl + /"],
];

const TABS = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "data", label: "Data controls", icon: Database },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "safety", label: "Safety", icon: ShieldAlert },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("general");
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["settings-me"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
  const userId = me?.id;

  const { data: profile } = useQuery({
    queryKey: ["settings-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, safe_mode")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      const { data: priv } = await supabase
        .from("profile_private")
        .select("location, birth_year")
        .eq("user_id", userId!)
        .maybeSingle();
      return data
        ? { ...data, location: priv?.location ?? "", birth_year: priv?.birth_year ?? null }
        : null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-prefs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) } as Settings;
    },
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["settings-blocked", userId],
    enabled: !!userId && tab === "privacy",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("id, blocked_id")
        .eq("blocker_id", userId!);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.blocked_id);
      if (ids.length === 0) return [] as Array<{ id: string; username: string }>;
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      return (data ?? []).map((r) => ({
        id: r.id,
        username: profs?.find((p) => p.id === r.blocked_id)?.username ?? "unknown",
      }));
    },
  });

  const { data: moderation = [] } = useQuery({
    queryKey: ["settings-moderation", userId],
    enabled: !!userId && tab === "safety",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_events")
        .select("id, direction, severity, action, categories, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suspension } = useQuery({
    queryKey: ["settings-suspension", userId],
    enabled: !!userId && tab === "safety",
    queryFn: async () => {
      const { data } = await supabase
        .from("account_suspensions")
        .select("suspended_until, reason")
        .gt("suspended_until", new Date().toISOString())
        .order("suspended_until", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: myReports = [] } = useQuery({
    queryKey: ["settings-reports", userId],
    enabled: !!userId && tab === "safety",
    queryFn: async () => {
      const { data } = await supabase
        .from("content_reports")
        .select("id, reason, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const [reportOpen, setReportOpen] = useState(false);

  const updateProfileSafety = async (patch: {
    safe_mode?: boolean;
    birth_year?: number | null;
  }) => {
    if (!userId) return;
    const { birth_year, ...profilePatch } = patch;
    let error = null as { message: string } | null;
    if (Object.keys(profilePatch).length) {
      ({ error } = await supabase.from("profiles").update(profilePatch).eq("id", userId));
    }
    if (!error && birth_year !== undefined) {
      ({ error } = await supabase
        .from("profile_private")
        .upsert({ user_id: userId, birth_year }, { onConflict: "user_id" }));
    }
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["settings-profile", userId] });
  };

  const [form, setForm] = useState({ display_name: "", username: "", bio: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
      });
    }
  }, [profile]);

  const s = settings ?? DEFAULTS;

  const updateSetting = async (patch: Partial<Settings>) => {
    if (!userId) return;
    queryClient.setQueryData(["settings-prefs", userId], { ...s, ...patch });
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...s, ...patch }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
  };

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name,
        username: form.username,
        bio: form.bio,
      })
      .eq("id", userId);
    if (!error) {
      await supabase
        .from("profile_private")
        .upsert({ user_id: userId, location: form.location }, { onConflict: "user_id" });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["settings-profile", userId] });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`,
          );
          const json = await res.json();
          const label = [json.city || json.locality, json.principalSubdivision, json.countryName]
            .filter(Boolean)
            .join(", ");
          setForm((f) => ({ ...f, location: label }));
        } catch {
          toast.error("Could not resolve your location");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Location permission denied");
      },
    );
  };

  const exportData = async () => {
    if (!userId) return;
    const [p, msgs, stories, threads] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("messages").select("*").eq("sender_id", userId),
      supabase.from("stories").select("*").eq("author_id", userId),
      supabase.from("ai_threads").select("*").eq("user_id", userId),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          { profile: p.data, messages: msgs.data, stories: stories.data, ai_threads: threads.data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alaska-ai-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  const clearAiHistory = async () => {
    if (!userId) return;
    const { error } = await supabase.from("ai_threads").delete().eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["ai-threads"] });
    toast.success("Alaska chat history cleared");
  };

  const clearMyMessages = async () => {
    if (!userId) return;
    const { error } = await supabase.from("messages").delete().eq("sender_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your messages were deleted");
  };

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/auth";
  };

  const initials = useMemo(
    () => (form.display_name || form.username || "A").slice(0, 2).toUpperCase(),
    [form.display_name, form.username],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your Alaska AI preferences
          </DialogDescription>
        </DialogHeader>
        <div className="flex h-[70vh] max-h-[560px] flex-col sm:flex-row">
          <div className="shrink-0 overflow-x-auto border-b border-border p-2 sm:w-52 sm:overflow-x-visible sm:border-b-0 sm:border-r">
            <div className="flex gap-1 sm:flex-col">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    tab === t.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 px-5 py-4">
              {tab === "general" && (
                <>
                  <Row label="Theme" hint="Alaska white/blue or dark aurora">
                    <Button variant="outline" size="sm" className="gap-2" onClick={toggle}>
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                      {theme === "dark" ? "Light" : "Dark"}
                    </Button>
                  </Row>
                  <Row label="Enter is send" hint="Press Enter to send a message">
                    <Switch
                      checked={s.enter_to_send}
                      onCheckedChange={(v) => updateSetting({ enter_to_send: v })}
                    />
                  </Row>
                  <Row label="Message sounds">
                    <Switch
                      checked={s.message_sounds}
                      onCheckedChange={(v) => updateSetting({ message_sounds: v })}
                    />
                  </Row>
                  <Row label="Signed in as">
                    <span className="text-sm text-muted-foreground">{me?.email ?? "—"}</span>
                  </Row>
                </>
              )}

              {tab === "profile" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                      {initials}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your public identity on Alaska AI
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Display name</Label>
                      <Input
                        value={form.display_name}
                        onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Username</Label>
                      <Input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bio</Label>
                    <Textarea
                      rows={3}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <div className="flex gap-2">
                      <Input
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        placeholder="City, region"
                      />
                      <Button variant="outline" onClick={useMyLocation} disabled={locating}>
                        {locating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Use my location"
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button onClick={saveProfile} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              )}

              {tab === "appearance" && (
                <>
                  <Row label="Color mode" hint="Matches your Alaska brand palette">
                    <Button variant="outline" size="sm" className="gap-2" onClick={toggle}>
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                      {theme === "dark" ? "Light" : "Dark"}
                    </Button>
                  </Row>
                  <Row label="Font size" hint="Applies to chat text">
                    <Select
                      value={s.font_size}
                      onValueChange={(v) => updateSetting({ font_size: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                </>
              )}

              {tab === "chats" && (
                <>
                  <Row label="Enter is send">
                    <Switch
                      checked={s.enter_to_send}
                      onCheckedChange={(v) => updateSetting({ enter_to_send: v })}
                    />
                  </Row>
                  <Row label="Disappearing messages" hint="New chats default to disappearing">
                    <Switch
                      checked={s.disappearing}
                      onCheckedChange={(v) => updateSetting({ disappearing: v })}
                    />
                  </Row>
                  <Row label="Font size">
                    <Select
                      value={s.font_size}
                      onValueChange={(v) => updateSetting({ font_size: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="Clear my messages" hint="Deletes every message you sent">
                    <Button variant="outline" size="sm" className="gap-2" onClick={clearMyMessages}>
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </Button>
                  </Row>
                </>
              )}

              {tab === "notifications" && (
                <>
                  <Row label="Message sounds">
                    <Switch
                      checked={s.message_sounds}
                      onCheckedChange={(v) => updateSetting({ message_sounds: v })}
                    />
                  </Row>
                  <Row label="Group notifications">
                    <Switch
                      checked={s.group_notifications}
                      onCheckedChange={(v) => updateSetting({ group_notifications: v })}
                    />
                  </Row>
                  <Row label="Story notifications">
                    <Switch
                      checked={s.story_notifications}
                      onCheckedChange={(v) => updateSetting({ story_notifications: v })}
                    />
                  </Row>
                </>
              )}

              {tab === "safety" && (
                <>
                  {suspension ? (
                    <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                      Your account is suspended until{" "}
                      {new Date(suspension.suspended_until).toLocaleString()}
                      {suspension.reason ? ` — ${suspension.reason}` : ""}.
                    </div>
                  ) : null}

                  <Row
                    label="Safe mode (age-appropriate)"
                    hint="Filters sexual, graphic, gambling and substance content from Alaska's answers"
                  >
                    <Switch
                      checked={profile?.safe_mode !== false}
                      onCheckedChange={(v) => updateProfileSafety({ safe_mode: v })}
                    />
                  </Row>
                  <Row label="Birth year" hint="Under 18 keeps safe mode on automatically">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1900}
                      max={new Date().getFullYear()}
                      defaultValue={profile?.birth_year ?? ""}
                      className="w-28"
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        updateProfileSafety({
                          birth_year: Number.isFinite(value) && value > 1900 ? value : null,
                        });
                      }}
                    />
                  </Row>
                  <Row
                    label="Report abuse"
                    hint="Tell moderators about harmful content or behaviour"
                  >
                    <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
                      <Flag className="mr-2 h-4 w-4" /> Report
                    </Button>
                  </Row>

                  <div className="pt-3">
                    <p className="text-sm font-medium">Your reports</p>
                    {myReports.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">No reports sent</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {myReports.map((report) => (
                          <div
                            key={report.id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                          >
                            <span>{report.reason}</span>
                            <span className="text-muted-foreground">{report.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4">
                    <p className="text-sm font-medium">Safety activity</p>
                    <p className="text-xs text-muted-foreground">
                      Messages our filters flagged on your account
                    </p>
                    {moderation.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">Nothing flagged — nice.</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {moderation.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                          >
                            <span>
                              {event.action === "blocked" ? "Blocked" : "Flagged"} ·{" "}
                              {event.categories?.join(", ") || event.severity}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(event.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <ReportDialog
                    open={reportOpen}
                    onOpenChange={setReportOpen}
                    target={{ type: "user", label: "a safety problem" }}
                  />
                </>
              )}

              {tab === "privacy" && (
                <>
                  <Row
                    label="Chat privacy"
                    hint="Blur chats until you interact and stop sharing your activity"
                  >
                    <Switch
                      checked={s.chat_privacy}
                      onCheckedChange={(v) =>
                        updateSetting(
                          v
                            ? { chat_privacy: true, read_receipts: false, last_seen: false }
                            : { chat_privacy: false },
                        )
                      }
                    />
                  </Row>
                  <Row label="Hide message previews" hint="Notifications won't show message text">
                    <Switch
                      checked={s.hide_message_previews}
                      onCheckedChange={(v) => updateSetting({ hide_message_previews: v })}
                    />
                  </Row>
                  <Row label="Read receipts">
                    <Switch
                      checked={s.read_receipts}
                      onCheckedChange={(v) => updateSetting({ read_receipts: v })}
                    />
                  </Row>
                  <Row label="Last seen">
                    <Switch
                      checked={s.last_seen}
                      onCheckedChange={(v) => updateSetting({ last_seen: v })}
                    />
                  </Row>
                  <Row label="Profile photo visible to">
                    <Select
                      value={s.profile_photo_privacy}
                      onValueChange={(v) => updateSetting({ profile_photo_privacy: v })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">Everyone</SelectItem>
                        <SelectItem value="friends">Friends</SelectItem>
                        <SelectItem value="nobody">Nobody</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <div className="pt-3">
                    <p className="text-sm font-medium">Blocked contacts</p>
                    {blocked.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">No blocked contacts</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {blocked.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                          >
                            <span>@{b.username}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await supabase.from("blocked_users").delete().eq("id", b.id);
                                queryClient.invalidateQueries({
                                  queryKey: ["settings-blocked", userId],
                                });
                              }}
                            >
                              Unblock
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === "data" && (
                <>
                  <Row
                    label="Export my data"
                    hint="Profile, messages, stories and AI threads as JSON"
                  >
                    <Button variant="outline" size="sm" onClick={exportData}>
                      Export
                    </Button>
                  </Row>
                  <Row label="Clear Alaska chat history" hint="Deletes all AI conversations">
                    <Button variant="outline" size="sm" className="gap-2" onClick={clearAiHistory}>
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </Button>
                  </Row>
                  <Row
                    label="Privacy & data controls"
                    hint="See stored data, chat/story visibility, and delete your account"
                  >
                    <Button asChild variant="outline" size="sm">
                      <Link to="/privacy" onClick={() => setOpen(false)}>
                        Open
                      </Link>
                    </Button>
                  </Row>
                </>
              )}

              {tab === "shortcuts" && (
                <div className="space-y-1">
                  {SHORTCUTS.map(([label, keys]) => (
                    <Row key={label} label={label}>
                      <kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs">
                        {keys}
                      </kbd>
                    </Row>
                  ))}
                </div>
              )}

              {tab === "security" && (
                <>
                  <Row label="Email" hint="Used to sign in">
                    <span className="text-sm text-muted-foreground">{me?.email ?? "—"}</span>
                  </Row>
                  <Row label="Password reset" hint="We'll email you a reset link">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!me?.email) return;
                        const { error } = await supabase.auth.resetPasswordForEmail(me.email, {
                          redirectTo: `${window.location.origin}/auth`,
                        });
                        if (error) {
                          toast.error(error.message);
                          return;
                        }
                        toast.success("Reset link sent");
                      }}
                    >
                      Send link
                    </Button>
                  </Row>
                  <TwoFactorSetup />
                  <Row label="Sign out of all devices">
                    <Button variant="destructive" size="sm" onClick={signOutEverywhere}>
                      Sign out everywhere
                    </Button>
                  </Row>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
