import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, FileUp, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getAccessToken } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Passage = {
  chunk_id: string;
  document_id: string;
  title: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

async function callKnowledge(body: Record<string, unknown>) {
  const response = await fetch("/api/knowledge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || "Request failed");
  return response.json();
}

export function KnowledgeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState("");
  const [searching, setSearching] = useState(false);
  const [passages, setPassages] = useState<Passage[] | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["knowledge-documents"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("id, title, source, chunk_count, status, content, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
  };

  const save = async () => {
    if (!content.trim()) {
      toast.error("Paste or upload some text first.");
      return;
    }
    setSaving(true);
    try {
      const result = (await callKnowledge({
        action: "ingest",
        documentId: editingId ?? undefined,
        title: title.trim() || "Untitled",
        content,
        source: "paste",
      })) as { chunks: number };
      toast.success(`Indexed ${result.chunks} section${result.chunks === 1 ? "" : "s"}.`);
      reset();
      queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not index that document.");
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (editingId === id) reset();
    queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
    toast.success("Document removed — its passages are gone from search too.");
  };

  const runSearch = async () => {
    if (!question.trim()) return;
    setSearching(true);
    setPassages(null);
    try {
      const result = (await callKnowledge({ action: "search", question })) as {
        passages: Passage[];
      };
      setPassages(result.passages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge base
          </DialogTitle>
          <DialogDescription>
            Alaska reads these documents before answering and cites the sections it used. Only you
            can see or search your own documents.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="add">{editingId ? "Update" : "Add"}</TabsTrigger>
            <TabsTrigger value="test">Test retrieval</TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <ScrollArea className="max-h-[55vh]">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No documents yet — add notes, papers or research updates in the “Add” tab.
                </p>
              ) : (
                <div className="space-y-2 pr-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.chunk_count} section{doc.chunk_count === 1 ? "" : "s"} · updated{" "}
                          {new Date(doc.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      {doc.status !== "ready" ? (
                        <Badge variant="secondary" className="text-xs">
                          {doc.status}
                        </Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        title="Edit and re-index"
                        onClick={() => {
                          setEditingId(doc.id);
                          setTitle(doc.title);
                          setContent(doc.content);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive"
                        title="Delete document"
                        onClick={() => remove(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add" className="space-y-3">
            <Input
              placeholder="Document title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Textarea
              placeholder="Paste the document text here…"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[220px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload .txt / .md
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.csv,text/plain"
                    className="hidden"
                    onChange={(event) => onFile(event.target.files?.[0])}
                  />
                </label>
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Re-index document" : "Add to knowledge base"}
              </Button>
              {editingId ? (
                <Button size="sm" variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question to see which passages come back"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && runSearch()}
              />
              <Button size="icon" onClick={runSearch} disabled={searching} aria-label="Search">
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <ScrollArea className="max-h-[45vh]">
              {passages === null ? null : passages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing relevant enough was retrieved — Alaska would answer without citing your
                  documents.
                </p>
              ) : (
                <div className="space-y-2 pr-3">
                  {passages.map((passage, index) => (
                    <div key={passage.chunk_id} className="rounded-xl border border-border p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        [{index + 1}] {passage.title} · section {passage.chunk_index + 1} ·
                        relevance {passage.similarity.toFixed(2)}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{passage.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
