import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  FolderOpen,
  ImagePlus,
  Images,
  Mic,
  Paperclip,
  Save,
  ScanLine,
  Share2,
  Sparkles,
  AudioLines,
  Square,
  Volume2,
  VenetianMask,
  X,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { VoiceAssistantDialog } from "@/components/voice-assistant-dialog";
import { AlaskaMark } from "@/components/brand";
import { EmojiPicker } from "@/components/emoji-picker";
import { KnowledgeDialog } from "@/components/knowledge-dialog";
import { ImageLibraryDialog } from "@/components/image-library-dialog";
import { ProjectsDialog } from "@/components/projects-dialog";
import { ScanDialog, type ScanResult } from "@/components/scan-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVoiceReply } from "@/hooks/use-voice-reply";
import { getAccessToken } from "@/hooks/useAuth";
import { saveImageToLibrary, streamImage } from "@/lib/stream-image";
import { VOICE_LANGUAGES } from "@/lib/voice-languages";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

function AttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs"
        >
          {file.mediaType?.startsWith("image/") && file.url ? (
            <img
              src={file.url}
              alt={file.filename ?? "attachment"}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[140px] truncate">{file.filename ?? "Attachment"}</span>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => attachments.remove(file.id)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AiChatWindow({
  threadId,
  initialMessages,
  title,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  title: string;
}) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [quality, setQuality] = useState<"fast" | "high">("fast");
  const [aspect, setAspect] = useState<"square" | "landscape" | "portrait">("square");
  const [generating, setGenerating] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [images, setImages] = useState<{ prompt: string; url: string; isFinal: boolean }[]>([]);
  const [incognito, setIncognito] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { language: voiceLang, setLanguage: setVoiceLang, t } = useLanguage();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
      body: { threadId, language: voiceLang },
    }),
    onError: (error) => toast.error(error.message || "The assistant is unavailable right now."),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const {
    supported: voiceSupported,
    speaking,
    speak,
    stop: stopSpeaking,
  } = useVoiceReply(false, voiceLang);

  const lastMessage = messages[messages.length - 1];
  const assistantHasOutput =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((part) => part.type === "text" && part.text.length > 0);
  const showThinking = isLoading && !assistantHasOutput;

  const copyResponse = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      toast.error("Couldn't copy that response.");
    }
  };

  const shareResponse = async (text: string) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Alaska AI", text });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Response copied — ready to share.");
    } catch {
      toast.error("Couldn't share that response.");
    }
  };

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const runScan = (result: ScanResult) => {
    if (isLoading) return;
    sendMessage(
      {
        text: [
          "Scan this image.",
          "1. Transcribe every piece of text you can read, verbatim, under a heading **Extracted text**.",
          "2. Then, under **Answer**, say what this is and give me a direct, useful answer to whatever it asks or shows.",
          "If there is no text, say so and describe the object instead.",
        ].join("\n"),
        files: [
          {
            type: "file",
            mediaType: result.mediaType,
            filename: result.filename,
            url: result.dataUrl,
          },
        ],
      },
      { body: { incognito } },
    );
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "voice.webm");
          form.append("language", voiceLang);
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { Authorization: `Bearer ${await getAccessToken()}` },
            body: form,
          });
          if (!response.ok) throw new Error(await response.text());
          const { text } = (await response.json()) as { text: string };
          if (text.trim())
            setInput((current) => (current ? `${current} ${text.trim()}` : text.trim()));
          else toast.info("Didn't catch that — try again.");
        } catch {
          toast.error("Couldn't transcribe that voice note.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access is blocked.");
    }
  };

  const generateImage = async (
    prompt: string,
    extra?: { referenceImage?: string; variation?: boolean },
  ) => {
    setGenerating(true);
    let index = -1;
    setImages((current) => {
      index = current.length;
      return [...current, { prompt, url: "", isFinal: false }];
    });
    try {
      const token = await getAccessToken();
      await streamImage({ prompt, quality, aspect, ...extra }, token ?? "", (url, isFinal) => {
        setImages((current) => {
          const next = [...current];
          next[index] = { prompt, url, isFinal };
          return next;
        });
      });
    } catch (error) {
      setImages((current) => current.filter((_, i) => i !== index));
      toast.error(error instanceof Error ? error.message : "Couldn't create that image.");
    } finally {
      setGenerating(false);
    }
  };

  const makeVariations = async (image: { prompt: string; url: string }, count = 2) => {
    for (let i = 0; i < count; i += 1) {
      await generateImage(image.prompt || "variation", {
        referenceImage: image.url,
        variation: true,
      });
    }
  };

  const saveToLibrary = async (index: number) => {
    const image = images[index];
    if (!image) return;
    try {
      await saveImageToLibrary(image.url, image.prompt);
      setSaved((current) => ({ ...current, [index]: true }));
      toast.success("Saved to your image library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that image.");
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <AlaskaMark className="h-6 w-6" />
        {incognito ? (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <VenetianMask className="h-3 w-3" /> Incognito
          </span>
        ) : null}
      </header>

      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onScan={runScan} />

      {messages.length === 0 ? (
        <div className="absolute inset-x-0 top-14 bottom-40 z-10 flex flex-col items-center justify-center gap-3 p-8 text-center">
          {/* Dark blue lighting glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-72 w-72 animate-pulse rounded-full bg-blue-700/25 blur-[90px] dark:bg-blue-600/35" />
            <div className="absolute h-56 w-56 rounded-full bg-blue-900/20 blur-[70px] dark:bg-blue-800/30" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3">
            <AlaskaMark className="h-8 w-8" />
            <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              {t("chat.agenda")}
            </h1>
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {t("chat.subtitle")}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant={incognito ? "default" : "outline"}
                size="icon"
                aria-label="Incognito chat"
                title="Incognito chat — nothing is saved"
                onClick={() => {
                  setIncognito((value) => !value);
                  toast.info(incognito ? "Incognito off" : "Incognito on — this chat isn't saved");
                }}
              >
                <VenetianMask className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Scan"
                title="Scan a page or object for an instant answer"
                onClick={() => setScanOpen(true)}
              >
                <ScanLine className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Projects"
                title="Projects"
                onClick={() => setProjectsOpen(true)}
              >
                <FolderOpen className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Knowledge base"
                title="Knowledge base — answers grounded in your documents"
                onClick={() => setKnowledgeOpen(true)}
              >
                <BookOpen className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto flex h-full w-full max-w-3xl flex-col">
          {messages.length === 0
            ? null
            : messages.map((message) => {
                const messageText = message.parts
                  .map((part) => (part.type === "text" ? part.text : ""))
                  .join("\n")
                  .trim();
                return (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return <MessageResponse key={index}>{part.text}</MessageResponse>;
                        }
                        if (part.type === "file") {
                          return part.mediaType?.startsWith("image/") ? (
                            <img
                              key={index}
                              src={part.url}
                              alt={part.filename ?? "attachment"}
                              className="mb-2 max-h-64 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <span
                              key={index}
                              className="mb-2 flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-xs"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {part.filename ?? "Document"}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {message.role === "assistant" && messageText ? (
                        <div className="mt-2 flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={t("chat.copy")}
                            title={t("chat.copy")}
                            onClick={() => copyResponse(message.id, messageText)}
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={t("chat.share")}
                            title={t("chat.share")}
                            onClick={() => shareResponse(messageText)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "h-7 w-7 text-muted-foreground hover:text-foreground",
                              speaking && "text-primary",
                            )}
                            disabled={!voiceSupported}
                            aria-label={t("chat.readAloud")}
                            title={
                              voiceSupported
                                ? t("chat.readAloud")
                                : "Read aloud isn't supported in this browser"
                            }
                            onClick={() => (speaking ? stopSpeaking() : speak(messageText))}
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </MessageContent>
                  </Message>
                );
              })}

          {images.map((image, index) => (
            <div key={index} className="mb-4 space-y-2">
              <p className="text-xs text-muted-foreground">Image: {image.prompt}</p>
              {image.url ? (
                <img
                  src={image.url}
                  alt={image.prompt}
                  className={cn(
                    "max-h-96 rounded-xl border border-border object-contain transition-[filter]",
                    image.isFinal ? "blur-0" : "blur-xl",
                  )}
                />
              ) : (
                <div className="h-48 w-64 animate-pulse rounded-xl border border-border bg-muted" />
              )}
              {image.isFinal ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={generating}
                    onClick={() => makeVariations(image)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Variations
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={saved[index]}
                    onClick={() => saveToLibrary(index)}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saved[index] ? "Saved" : "Save to library"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" asChild>
                    <a href={image.url} download={`alaska-${index + 1}.png`}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {generating ? (
            <div className="flex items-center gap-2 px-1 py-2">
              <AlaskaMark className="h-4 w-4 animate-pulse" />
              <Shimmer className="text-sm">Creating your image…</Shimmer>
            </div>
          ) : null}

          {showThinking ? (
            <div className="flex items-center gap-2 px-1 py-2">
              <AlaskaMark className="h-4 w-4 animate-pulse" />
              <Shimmer className="text-sm">{t("chat.thinking")}</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <PromptInput
          multiple
          accept="image/*,application/pdf,text/*,.doc,.docx,.csv,.xlsx,.md"
          maxFileSize={20 * 1024 * 1024}
          onError={(error) => toast.error(error.message)}
          onSubmit={(message, event) => {
            event.preventDefault();
            const text = input.trim();
            if (imageMode) {
              if (!text || generating) return;
              setInput("");
              generateImage(text);
              return;
            }
            if ((!text && message.files.length === 0) || isLoading) return;
            sendMessage({ text, files: message.files }, { body: { incognito } });
            setInput("");
          }}
        >
          <PromptInputHeader>
            <AttachmentChips />
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                recording
                  ? "Recording… tap stop when done"
                  : imageMode
                    ? "Describe the image you want"
                    : t("chat.placeholder")
              }
              className="placeholder:text-muted-foreground/50"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger tooltip="Add photos, documents or create an image">
                  <Paperclip className="h-4 w-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label="Photos & documents" />
                  <PromptInputActionMenuItem onSelect={() => setImageMode((value) => !value)}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {imageMode ? "Cancel image creation" : "Create image"}
                  </PromptInputActionMenuItem>
                  <PromptInputActionMenuItem onSelect={() => setLibraryOpen(true)}>
                    <Images className="mr-2 h-4 w-4" />
                    Image library
                  </PromptInputActionMenuItem>
                  <PromptInputActionMenuItem onSelect={() => setScanOpen(true)}>
                    <ScanLine className="mr-2 h-4 w-4" />
                    Scan with camera
                  </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              {imageMode ? (
                <>
                  <PromptInputButton
                    tooltip="Image mode on"
                    onClick={() => setImageMode(false)}
                    className="text-primary"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Image
                  </PromptInputButton>
                  <Select value={quality} onValueChange={(v) => setQuality(v as "fast" | "high")}>
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="high">High detail</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={aspect}
                    onValueChange={(v) => setAspect(v as "square" | "landscape" | "portrait")}
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : null}
              <EmojiPicker onSelect={(emoji) => setInput((current) => `${current}${emoji}`)} />

              <PromptInputButton
                tooltip="Voice assistant — talk hands-free in 7 languages"
                onClick={() => setVoiceAssistantOpen(true)}
                className={cn(voiceAssistantOpen && "text-primary")}
              >
                <AudioLines className="h-4 w-4" />
              </PromptInputButton>
              <PromptInputButton
                tooltip={recording ? "Stop recording" : "Voice message"}
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={cn(recording && "text-destructive")}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </PromptInputButton>
              <Select value={voiceLang} onValueChange={setVoiceLang}>
                <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Read aloud language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {transcribing ? <Shimmer className="text-xs">Transcribing…</Shimmer> : null}
            </PromptInputTools>
            <PromptInputSubmit
              status={generating ? "submitted" : status}
              disabled={isLoading || generating}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>

      <VoiceAssistantDialog open={voiceAssistantOpen} onOpenChange={setVoiceAssistantOpen} />

      <ProjectsDialog open={projectsOpen} onOpenChange={setProjectsOpen} />
      <KnowledgeDialog open={knowledgeOpen} onOpenChange={setKnowledgeOpen} />

      <ImageLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onUseAsReference={(dataUrl, prompt) => {
          setImageMode(true);
          generateImage(prompt || "variation", { referenceImage: dataUrl, variation: true });
        }}
      />
    </div>
  );
}
