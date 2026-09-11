import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  Database,
  HelpCircle,
  Keyboard,
  Loader2,
  LogOut,
  Lock,
  MessageSquare,
  Moon,
  MapPin,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Settings — Alaska AI" },
      {
        name: "description",
        content:
          "Manage your Alaska AI account, privacy, chats, notifications and appearance in one place.",
      },
      { property: "og:title", content: "Settings — Alaska AI" },
      {
        property: "og:description",
        content: "Account, privacy, chats, notifications and appearance settings for Alaska AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

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
};

const FONT_SCALE: Record<string, string> = { small: "15px", medium: "16px", large: "18px" };

const SHORTCUTS: Array<[string, string]> = [
  ["New chat", "Ctrl + N"],
  ["Search", "Ctrl + K"],
  ["Next chat", "Ctrl + Tab"],
  ["New story", "Ctrl + Shift + S"],
  ["Ask Alaska AI", "Ctrl + /"],
];

function SettingRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [blockQuery, setBlockQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ files: number; bytes: number } | null>(null);
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      setEmail(userData.user?.email ?? "");
      if (!me) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, bio, avatar_url")
        .eq("id", me)
        .maybeSingle();
      if (error) throw error;
      const { data: priv } = await supabase
        .from("profile_private")
        .select("location")
        .eq("user_id", me)
        .maybeSingle();
      return data ? { ...data, location: priv?.location ?? "" } : null;
    },
  });

  const { data: dbSettings } = useQuery({
    queryKey: ["my-settings"],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", profile!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["blocked-users"],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: rows } = await supabase.from("blocked_users").select("id, blocked_id");
      if (!rows?.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in(
          "id",
          rows.map((r) => r.blocked_id),
        );
      return rows.map((r) => ({
        id: r.id,
        person: people?.find((p) => p.id === r.blocked_id) ?? null,
      }));
    },
  });

  useEffect(() => {
    if (dbSettings) {
      const { user_id: _u, updated_at: _t, ...rest } = dbSettings as Record<string, unknown>;
      setSettings({ ...DEFAULTS, ...(rest as Partial<Settings>) });
    }
  }, [dbSettings]);

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SCALE[settings.font_size] ?? "16px";
  }, [settings.font_size]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setLocation((profile as { location?: string }).location ?? "");
    if (profile.avatar_url) {
      supabase.storage
        .from("media")
        .createSignedUrl(profile.avatar_url, 3600)
        .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
    }
  }, [profile]);

  const setSetting = async (key: keyof Settings, value: boolean | string) => {
    if (!profile) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: profile.id, ...next, updated_at: new Date().toISOString() });
    if (error) toast.error("Could not save setting");
  };

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const place = (await response.json()) as {
            city?: string;
            locality?: string;
            principalSubdivision?: string;
            countryName?: string;
          };
          const label = [
            place.city || place.locality,
            place.principalSubdivision,
            place.countryName,
          ]
            .filter(Boolean)
            .join(", ");
          setLocation(label || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
          toast.success("Location detected — remember to save");
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
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username: username.trim().toLowerCase(),
        bio,
        theme,
      })
      .eq("id", profile.id);
    if (!error) {
      await supabase
        .from("profile_private")
        .upsert({ user_id: profile.id, location }, { onConflict: "user_id" });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success("Profile updated");
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    const path = `${profile.id}/avatar/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) {
      toast.error("Upload failed");
      return;
    }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.id);
    const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
    setAvatarUrl(data?.signedUrl ?? null);
    toast.success("Photo updated");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    setNewPassword("");
    if (error) toast.error(error.message);
    else toast.success("Password changed");
  };

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth" });
  };

  const blockUser = async () => {
    const handle = blockQuery.trim().toLowerCase().replace("@", "");
    if (!handle || !profile) return;
    const { data: person } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", handle)
      .maybeSingle();
    if (!person) {
      toast.error("No one found with that username");
      return;
    }
    const { error } = await supabase
      .from("blocked_users")
      .insert({ blocker_id: profile.id, blocked_id: person.id });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already blocked" : error.message);
      return;
    }
    setBlockQuery("");
    queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    toast.success(`@${handle} blocked`);
  };

  const unblock = async (rowId: string) => {
    await supabase.from("blocked_users").delete().eq("id", rowId);
    queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
    toast.success("Unblocked");
  };

  const exportData = async () => {
    if (!profile) return;
    setBusy(true);
    const [{ data: messages }, { data: stories }, { data: aiMessages }] = await Promise.all([
      supabase.from("messages").select("*").eq("sender_id", profile.id),
      supabase.from("stories").select("*").eq("author_id", profile.id),
      supabase.from("ai_messages").select("*"),
    ]);
    setBusy(false);
    const blob = new Blob(
      [JSON.stringify({ profile, settings, messages, stories, aiMessages }, null, 2)],
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

  const clearMyMessages = async () => {
    if (!profile) return;
    if (!confirm("Delete all messages you have sent? This cannot be undone.")) return;
    const { error } = await supabase.from("messages").delete().eq("sender_id", profile.id);
    if (error) toast.error(error.message);
    else toast.success("Your messages were deleted");
  };

  const loadStorage = async () => {
    if (!profile) return;
    const { data } = await supabase.storage.from("media").list(profile.id, { limit: 100 });
    const folders = data ?? [];
    let files = 0;
    let bytes = 0;
    for (const folder of folders) {
      const { data: inner } = await supabase.storage
        .from("media")
        .list(`${profile.id}/${folder.name}`, { limit: 200 });
      for (const f of inner ?? []) {
        files += 1;
        bytes += (f.metadata as { size?: number } | null)?.size ?? 0;
      }
    }
    setStorage({ files, bytes });
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications aren't supported here");
      return;
    }
    const result = await Notification.requestPermission();
    if (result === "granted") {
      new Notification("Alaska AI", { body: "Notifications are on." });
      toast.success("Notifications enabled");
    } else {
      toast.error("Notifications blocked");
    }
  };

  const sections = useMemo(
    () => [
      {
        id: "account",
        icon: UserRound,
        title: "Account",
        subtitle: "Profile info, password, email, sessions",
      },
      {
        id: "privacy",
        icon: Lock,
        title: "Privacy",
        subtitle: "Blocked contacts, disappearing messages, last seen",
      },
      {
        id: "chats",
        icon: MessageSquare,
        title: "Chats",
        subtitle: "Theme, font size, chat history",
      },
      {
        id: "notifications",
        icon: Bell,
        title: "Notifications",
        subtitle: "Messages, groups, stories, sounds",
      },
      {
        id: "storage",
        icon: Database,
        title: "Storage and data",
        subtitle: "Media usage, export your data",
      },
      {
        id: "security",
        icon: ShieldCheck,
        title: "Security",
        subtitle: "Sessions, sign out everywhere",
      },
      { id: "shortcuts", icon: Keyboard, title: "Keyboard shortcuts", subtitle: "Quick actions" },
      {
        id: "help",
        icon: HelpCircle,
        title: "Help and feedback",
        subtitle: "Help centre, contact us, privacy policy",
      },
    ],
    [],
  );

  const query = search.trim().toLowerCase();
  const visible = sections.filter(
    (section) =>
      !query ||
      section.title.toLowerCase().includes(query) ||
      section.subtitle.toLowerCase().includes(query),
  );

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search settings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Avatar className="h-16 w-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {(displayName || username || "A").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{displayName || "Your name"}</p>
            <p className="truncate text-sm text-muted-foreground">
              {bio || `@${username || "username"}`}
            </p>
          </div>
          <label className="cursor-pointer text-sm font-medium text-primary">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
          </label>
        </div>

        <Accordion
          type="single"
          collapsible
          className="mt-4 rounded-2xl border border-border bg-card px-2 shadow-soft"
        >
          {visible.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border-border last:border-0"
            >
              <AccordionTrigger className="px-3 hover:no-underline [&>svg]:hidden">
                <div className="flex w-full items-center gap-4 text-left">
                  <section.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{section.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4 pl-12">
                {section.id === "account" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Display name</Label>
                        <Input
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Username</Label>
                        <Input
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bio</Label>
                      <Textarea
                        className="min-h-20"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="What are you researching?"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Location</Label>
                      <div className="flex gap-2">
                        <Input
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="City, region"
                        />
                        <Button
                          variant="outline"
                          onClick={detectLocation}
                          disabled={locating}
                          className="gap-2 shrink-0"
                        >
                          {locating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          Use my location
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Shown on your profile. Your browser will ask for permission.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input value={email} disabled />
                    </div>
                    <Button onClick={save} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save changes
                    </Button>

                    <div className="space-y-1.5 border-t border-border pt-4">
                      <Label>Change password</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="New password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                        <Button variant="outline" onClick={changePassword} disabled={busy}>
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {section.id === "privacy" ? (
                  <div className="divide-y divide-border">
                    <SettingRow
                      label="Read receipts"
                      hint="Let friends know when you've read their message."
                      checked={settings.read_receipts}
                      onChange={(value) => setSetting("read_receipts", value)}
                    />
                    <SettingRow
                      label="Last seen"
                      hint="Show when you were last active."
                      checked={settings.last_seen}
                      onChange={(value) => setSetting("last_seen", value)}
                    />
                    <SettingRow
                      label="Disappearing messages"
                      hint="New messages vanish after 24 hours."
                      checked={settings.disappearing}
                      onChange={(value) => setSetting("disappearing", value)}
                    />
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Profile photo</p>
                        <p className="text-xs text-muted-foreground">Who can see your photo.</p>
                      </div>
                      <Select
                        value={settings.profile_photo_privacy}
                        onValueChange={(value) => setSetting("profile_photo_privacy", value)}
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
                    </div>
                    <div className="space-y-3 pt-3">
                      <Label>Blocked contacts</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="@username"
                          value={blockQuery}
                          onChange={(event) => setBlockQuery(event.target.value)}
                        />
                        <Button variant="outline" onClick={blockUser}>
                          Block
                        </Button>
                      </div>
                      {blocked.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No blocked contacts yet.</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {blocked.map((row) => (
                            <li key={row.id} className="flex items-center justify-between py-2">
                              <span className="text-sm">
                                {row.person?.display_name ?? "Unknown"}{" "}
                                <span className="text-muted-foreground">
                                  @{row.person?.username}
                                </span>
                              </span>
                              <Button variant="ghost" size="sm" onClick={() => unblock(row.id)}>
                                Unblock
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}

                {section.id === "chats" ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Appearance</p>
                      <p className="text-xs text-muted-foreground">
                        Match your Alaska brand, light or dark.
                      </p>
                      <div className="mt-3 flex gap-3">
                        <Button
                          variant={theme === "light" ? "default" : "outline"}
                          className="gap-2"
                          onClick={() => setTheme("light")}
                        >
                          <Sun className="h-4 w-4" />
                          White & blue
                        </Button>
                        <Button
                          variant={theme === "dark" ? "default" : "outline"}
                          className="gap-2"
                          onClick={() => setTheme("dark")}
                        >
                          <Moon className="h-4 w-4" />
                          Polar night
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                      <div>
                        <p className="text-sm font-medium">Font size</p>
                        <p className="text-xs text-muted-foreground">Applies across the app.</p>
                      </div>
                      <Select
                        value={settings.font_size}
                        onValueChange={(value) => setSetting("font_size", value)}
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
                    </div>
                    <SettingRow
                      label="Enter is send"
                      hint="Press Enter to send a message."
                      checked={settings.enter_to_send}
                      onChange={(value) => setSetting("enter_to_send", value)}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button variant="outline" size="sm" onClick={exportData} disabled={busy}>
                        Export chat history
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive"
                        onClick={clearMyMessages}
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear my messages
                      </Button>
                    </div>
                  </div>
                ) : null}

                {section.id === "notifications" ? (
                  <div className="divide-y divide-border">
                    <SettingRow
                      label="Message sounds"
                      checked={settings.message_sounds}
                      onChange={(value) => setSetting("message_sounds", value)}
                    />
                    <SettingRow
                      label="Group notifications"
                      checked={settings.group_notifications}
                      onChange={(value) => setSetting("group_notifications", value)}
                    />
                    <SettingRow
                      label="Story updates"
                      hint="Ping me when a friend posts a research update."
                      checked={settings.story_notifications}
                      onChange={(value) => setSetting("story_notifications", value)}
                    />
                    <div className="pt-3">
                      <Button variant="outline" size="sm" onClick={enableNotifications}>
                        Enable browser notifications
                      </Button>
                    </div>
                  </div>
                ) : null}

                {section.id === "storage" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {storage
                        ? `${storage.files} files · ${(storage.bytes / 1024 / 1024).toFixed(2)} MB used`
                        : "Check how much media you've uploaded."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={loadStorage}>
                        Calculate usage
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportData} disabled={busy}>
                        Export my data
                      </Button>
                    </div>
                  </div>
                ) : null}

                {section.id === "security" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Signed in as {email || "your account"}. Sign out of every device if you think
                      someone else has access.
                    </p>
                    <Button variant="outline" size="sm" onClick={signOutEverywhere}>
                      Sign out of all devices
                    </Button>
                  </div>
                ) : null}

                {section.id === "shortcuts" ? (
                  <div className="divide-y divide-border">
                    {SHORTCUTS.map(([label, keys]) => (
                      <div key={label} className="flex items-center justify-between py-2.5">
                        <p className="text-sm">{label}</p>
                        <kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                ) : null}

                {section.id === "help" ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Need a hand? Reach the Alaska AI team any time.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="mailto:support@alaska.ai">Contact us</a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
                        About Alaska AI
                      </Button>
                    </div>
                    <p className="text-xs">Alaska AI · version 1.0</p>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <button
          onClick={logout}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left text-destructive shadow-soft transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
}
