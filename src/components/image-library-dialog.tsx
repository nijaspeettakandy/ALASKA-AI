import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

export function ImageLibraryDialog({
  open,
  onOpenChange,
  onUseAsReference,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseAsReference?: (dataUrl: string, prompt: string) => void;
}) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["image-library"],
    enabled: open,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return [];
      const { data, error } = await supabase
        .from("image_library")
        .select("id, prompt, storage_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const signed = await Promise.all(
        rows.map(async (row) => {
          const { data: url } = await supabase.storage
            .from("media")
            .createSignedUrl(row.storage_path, 60 * 60);
          return { ...row, url: url?.signedUrl ?? "" };
        }),
      );
      return signed;
    },
  });

  const remove = async (id: string, path: string) => {
    await supabase.storage.from("media").remove([path]);
    const { error } = await supabase.from("image_library").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["image-library"] });
    toast.success("Removed from your library");
  };

  const handleUseReference = async (url: string, prompt: string) => {
    if (!onUseAsReference) return;
    const blob = await (await fetch(url)).blob();
    const reader = new FileReader();
    reader.onload = () => {
      onUseAsReference(String(reader.result), prompt);
      onOpenChange(false);
    };
    reader.readAsDataURL(blob);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Image library
          </DialogTitle>
          <DialogDescription>Every image you saved from Alaska AI.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nothing saved yet — create an image and tap “Save”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pr-3 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="space-y-2 rounded-xl border border-border p-2">
                  <img
                    src={item.url}
                    alt={item.prompt}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.prompt}</p>
                  <div className="flex flex-wrap gap-1">
                    {onUseAsReference ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleUseReference(item.url, item.prompt)}
                      >
                        Variations
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                      <a href={item.url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      onClick={() => remove(item.id, item.storage_path)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
