import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Search, UserPlus, X, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

function initials(name: string) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-none text-destructive-foreground shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function PersonRow({ profile, action }: { profile: Profile; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/50">
      <Avatar className="h-9 w-9">
        {profile.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-primary">
          {initials(profile.display_name || profile.username)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{profile.display_name || profile.username}</p>
        <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
      </div>
      {action}
    </div>
  );
}

export function FriendsDialog({
  variant = "default",
  label = "Find friends",
}: {
  variant?: "default" | "cta" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status");
      if (error) throw error;
      return data as Friendship[];
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["friend-requests-count", me],
    enabled: !!me,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", me!)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const relatedIds = friendships.flatMap((f) => [f.requester_id, f.addressee_id]);

  const { data: relatedProfiles = [] } = useQuery({
    queryKey: ["friend-profiles", relatedIds.join(",")],
    enabled: open && relatedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", relatedIds);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const profileOf = (id: string) => relatedProfiles.find((p) => p.id === id);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["profile-search", term],
    enabled: open && term.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${term.trim()}%`)
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!me) throw new Error("Not signed in");
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: me, addressee_id: addresseeId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Friend request sent");
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = accept
        ? await supabase.from("friendships").update({ status: "accepted" }).eq("id", id)
        : await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startChat = useMutation({
    mutationFn: async (friendId: string) => {
      if (!me) throw new Error("Not signed in");
      const { data: mine, error: mineErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", me);
      if (mineErr) throw mineErr;
      const myIds = (mine ?? []).map((m) => m.conversation_id);
      if (myIds.length > 0) {
        const { data: shared } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", friendId)
          .in("conversation_id", myIds);
        const candidateIds = (shared ?? []).map((s) => s.conversation_id);
        if (candidateIds.length > 0) {
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("is_group", false)
            .in("id", candidateIds)
            .limit(1);
          if (existing && existing.length > 0) return existing[0]!.id;
        }
      }
      const { data: created, error: convErr } = await supabase
        .from("conversations")
        .insert({ is_group: false, created_by: me })
        .select("id")
        .single();
      if (convErr) throw convErr;
      const { error: memErr } = await supabase.from("conversation_members").insert([
        { conversation_id: created.id, user_id: me },
        { conversation_id: created.id, user_id: friendId },
      ]);
      if (memErr) throw memErr;
      return created.id as string;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      navigate({ to: "/chat/$conversationId", params: { conversationId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      if (groupMembers.length < 2) throw new Error("Pick at least 2 friends");
      const { data: created, error: convErr } = await supabase
        .from("conversations")
        .insert({ is_group: true, created_by: me, title: groupTitle.trim() || "New group" })
        .select("id")
        .single();
      if (convErr) throw convErr;
      const { error: memErr } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: created.id, user_id: me },
          ...groupMembers.map((id) => ({ conversation_id: created.id, user_id: id })),
        ]);
      if (memErr) throw memErr;
      return created.id as string;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setGroupTitle("");
      setGroupMembers([]);
      setOpen(false);
      navigate({ to: "/chat/$conversationId", params: { conversationId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === me);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === me);
  const friends = friendships.filter((f) => f.status === "accepted");

  const statusFor = (userId: string) => {
    const f = friendships.find((x) => x.requester_id === userId || x.addressee_id === userId);
    return f?.status;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "cta" ? (
          <Button size="lg" className="relative gap-2">
            <UserPlus className="h-4 w-4" />
            {label}
            <CountBadge count={pendingCount} />
          </Button>
        ) : (
          <Button
            variant={variant === "ghost" ? "ghost" : "outline"}
            size="sm"
            className="relative gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {label}
            <CountBadge count={pendingCount} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
          <DialogDescription>
            Search people by username, send a request, and chat once they accept.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="search">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="requests">
              Requests{incoming.length > 0 ? ` (${incoming.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search by username"
                className="pl-9"
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {term.trim().length < 2 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters.
                </p>
              ) : isFetching ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Searching…</p>
              ) : results.filter((p) => p.id !== me).length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No one found.</p>
              ) : (
                results
                  .filter((p) => p.id !== me)
                  .map((p) => {
                    const status = statusFor(p.id);
                    return (
                      <PersonRow
                        key={p.id}
                        profile={p}
                        action={
                          status === "accepted" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={() => startChat.mutate(p.id)}
                            >
                              <MessageCircle className="h-4 w-4" /> Chat
                            </Button>
                          ) : status === "pending" ? (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={sendRequest.isPending}
                              onClick={() => sendRequest.mutate(p.id)}
                            >
                              <UserPlus className="h-4 w-4" /> Add
                            </Button>
                          )
                        }
                      />
                    );
                  })
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="max-h-72 space-y-1 overflow-y-auto">
            {incoming.length === 0 && outgoing.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No pending requests.
              </p>
            ) : null}
            {incoming.map((f) => {
              const p = profileOf(f.requester_id);
              if (!p) return null;
              return (
                <PersonRow
                  key={f.id}
                  profile={p}
                  action={
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => respond.mutate({ id: f.id, accept: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => respond.mutate({ id: f.id, accept: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
              );
            })}
            {outgoing.map((f) => {
              const p = profileOf(f.addressee_id);
              if (!p) return null;
              return (
                <PersonRow
                  key={f.id}
                  profile={p}
                  action={<span className="text-xs text-muted-foreground">Sent</span>}
                />
              );
            })}
          </TabsContent>

          <TabsContent value="friends" className="max-h-72 space-y-1 overflow-y-auto">
            {friends.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No friends yet. Search a username to add someone.
              </p>
            ) : (
              friends.map((f) => {
                const otherId = f.requester_id === me ? f.addressee_id : f.requester_id;
                const p = profileOf(otherId);
                if (!p) return null;
                return (
                  <PersonRow
                    key={f.id}
                    profile={p}
                    action={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        disabled={startChat.isPending}
                        onClick={() => startChat.mutate(otherId)}
                      >
                        <MessageCircle className="h-4 w-4" /> Chat
                      </Button>
                    }
                  />
                );
              })
            )}
          </TabsContent>

          <TabsContent value="group" className="space-y-3">
            <Input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {friends.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Add friends first to create a group.
                </p>
              ) : (
                friends.map((f) => {
                  const otherId = f.requester_id === me ? f.addressee_id : f.requester_id;
                  const p = profileOf(otherId);
                  if (!p) return null;
                  const selected = groupMembers.includes(otherId);
                  return (
                    <PersonRow
                      key={f.id}
                      profile={p}
                      action={
                        <Button
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className="gap-1"
                          onClick={() =>
                            setGroupMembers((prev) =>
                              selected ? prev.filter((id) => id !== otherId) : [...prev, otherId],
                            )
                          }
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                          {selected ? "Added" : "Add"}
                        </Button>
                      }
                    />
                  );
                })
              )}
            </div>
            <Button
              className="w-full gap-2"
              disabled={groupMembers.length < 2 || createGroup.isPending}
              onClick={() => createGroup.mutate()}
            >
              <Users className="h-4 w-4" />
              Create group{groupMembers.length > 0 ? ` (${groupMembers.length})` : ""}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
