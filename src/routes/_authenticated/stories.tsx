import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stories")({
  head: () => ({
    meta: [
      { title: "Stories — Alaska AI" },
      {
        name: "description",
        content: "Share research updates that your friends can watch for 24 hours.",
      },
    ],
  }),
  component: StoriesPage,
});

type StoryRow = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
};

function StoriesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: stories = [] } = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("id, title, body, image_url, created_at, author_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoryRow[];
    },
  });

  const post = async () => {
    if (!title.trim()) {
      toast.error("Give your update a title");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) {
      setSaving(false);
      return;
    }

    let imagePath: string | null = null;
    if (file) {
      const path = `${me}/stories/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("media").upload(path, file);
      if (uploadError) {
        toast.error("Image upload failed");
        setSaving(false);
        return;
      }
      imagePath = path;
    }

    const { error } = await supabase
      .from("stories")
      .insert({ author_id: me, title: title.trim(), body: body.trim(), image_url: imagePath });
    setSaving(false);
    if (error) {
      toast.error("Could not post your story");
      return;
    }
    setTitle("");
    setBody("");
    setFile(null);
    queryClient.invalidateQueries({ queryKey: ["stories"] });
    toast.success("Story posted — visible for 24 hours");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Stories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Research updates from you and your friends. Every story disappears after 24 hours.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Input
            placeholder="What did you discover?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            className="mt-3 min-h-24"
            placeholder="Add the details…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : "Add image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button onClick={post} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Post story
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active stories. Post the first research update.
            </p>
          ) : (
            stories.map((story) => <StoryCard key={story.id} story={story} />)
          )}
        </div>
      </div>
    </div>
  );
}

function StoryCard({ story }: { story: StoryRow }) {
  const { data: signedUrl } = useQuery({
    queryKey: ["story-image", story.id],
    enabled: Boolean(story.image_url),
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("media")
        .createSignedUrl(story.image_url as string, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const { data: author } = useQuery({
    queryKey: ["profile", story.author_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", story.author_id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-3 px-5 pt-5">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {(author?.display_name || author?.username || "A").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">
            {author?.display_name || author?.username || "Someone"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(story.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="px-5 py-4">
        <h2 className="text-base font-semibold">{story.title}</h2>
        {story.body ? <p className="mt-1 text-sm text-muted-foreground">{story.body}</p> : null}
      </div>
      {signedUrl ? (
        <img src={signedUrl} alt={story.title} className="max-h-96 w-full object-cover" />
      ) : null}
    </article>
  );
}
