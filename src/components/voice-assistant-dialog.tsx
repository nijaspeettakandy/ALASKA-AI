import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { VOICE_LANGUAGES, getVoiceLanguage } from "@/lib/voice-languages";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };
type Status = "idle" | "listening" | "thinking" | "speaking";

/** Silence (RMS) below this counts as "not talking". */
const SILENCE_LEVEL = 0.012;
/** Stop recording after this much silence once speech has started. */
const SILENCE_MS = 1400;
/** Hard cap on a single spoken turn. */
const MAX_TURN_MS = 30000;

export function VoiceAssistantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const { language, setLanguage } = useLanguage();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [handsFree, setHandsFree] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const langRef = useRef(language);
  const handsFreeRef = useRef(handsFree);
  const openRef = useRef(open);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(() => {
    langRef.current = language;
  }, [language]);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const teardown = useCallback(() => {
    try {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    } catch {
      /* already stopped */
    }
    recorderRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, onDone: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
      onDone();
      return;
    }
    const voice = getVoiceLanguage(langRef.current);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
    utterance.lang = voice.locale;
    const match = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang?.toLowerCase().startsWith(voice.code));
    if (match) utterance.voice = match;
    utterance.onend = onDone;
    utterance.onerror = onDone;
    setStatus("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  // Declared before listen() so the hands-free loop can call back into it.
  const listenRef = useRef<() => void>(() => {});

  const respond = useCallback(
    async (spokenText: string) => {
      setStatus("thinking");
      const next: Turn[] = [...turnsRef.current, { role: "user", content: spokenText }];
      setTurns(next);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Not signed in");

        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: next, language: langRef.current }),
        });
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as { text?: string };
        const reply = payload.text?.trim() || "Sorry, I didn't catch that.";
        setTurns((current) => [...current, { role: "assistant", content: reply }]);

        speak(reply, () => {
          if (openRef.current && handsFreeRef.current) listenRef.current();
          else setStatus("idle");
        });
      } catch (error) {
        setStatus("idle");
        toast.error(error instanceof Error ? error.message : "Voice assistant failed.");
      }
    },
    [speak],
  );

  const listen = useCallback(async () => {
    if (!openRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;

      const context = new AudioContext();
      audioCtxRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      let spoke = false;
      let silenceSince = performance.now();
      const startedAt = performance.now();

      const monitor = () => {
        if (recorder.state !== "recording") return;
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();
        if (rms > SILENCE_LEVEL) {
          spoke = true;
          silenceSince = now;
        }
        const quietLongEnough = spoke && now - silenceSince > SILENCE_MS;
        if (quietLongEnough || now - startedAt > MAX_TURN_MS) {
          recorder.stop();
          return;
        }
        requestAnimationFrame(monitor);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        void context.close().catch(() => {});
        audioCtxRef.current = null;
        recorderRef.current = null;
        if (!openRef.current) return;
        if (!spoke) {
          setStatus("idle");
          return;
        }

        setStatus("thinking");
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) throw new Error("Not signed in");

          const form = new FormData();
          form.append(
            "file",
            new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            "voice.webm",
          );
          form.append("language", langRef.current);
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!response.ok) throw new Error(await response.text());
          const payload = (await response.json()) as { text?: string };
          const said = payload.text?.trim();
          if (!said) {
            if (handsFreeRef.current && openRef.current) listenRef.current();
            else setStatus("idle");
            return;
          }
          await respond(said);
        } catch (error) {
          setStatus("idle");
          toast.error(error instanceof Error ? error.message : "Couldn't hear that.");
        }
      };

      recorder.start();
      setStatus("listening");
      requestAnimationFrame(monitor);
    } catch {
      setStatus("idle");
      toast.error("Microphone access is blocked.");
    }
  }, [respond]);

  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  useEffect(() => {
    if (!open) {
      teardown();
      setStatus("idle");
    }
  }, [open, teardown]);

  useEffect(() => teardown, [teardown]);

  const stopEverything = () => {
    teardown();
    setStatus("idle");
  };

  const label =
    status === "listening"
      ? "Listening…"
      : status === "thinking"
        ? "Alaska is thinking…"
        : status === "speaking"
          ? "Alaska is speaking…"
          : "Tap the mic and start talking";

  const lastTurn = turns[turns.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice assistant</DialogTitle>
          <DialogDescription>
            Talk to Alaska hands-free in 7 languages — it listens, answers and speaks back.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <span
              className={cn(
                "absolute inset-0 rounded-full bg-blue-600/25 blur-2xl transition-opacity",
                status === "idle" ? "opacity-40" : "opacity-100 animate-pulse",
              )}
            />
            <Button
              type="button"
              size="icon"
              onClick={status === "idle" ? () => void listen() : stopEverything}
              className="relative h-20 w-20 rounded-full"
              aria-label={status === "idle" ? "Start talking" : "Stop"}
            >
              {status === "thinking" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : status === "speaking" ? (
                <Volume2 className="h-7 w-7" />
              ) : status === "listening" ? (
                <Square className="h-6 w-6" />
              ) : (
                <Mic className="h-7 w-7" />
              )}
            </Button>
          </div>

          {status === "idle" ? (
            <p className="text-sm text-muted-foreground">{label}</p>
          ) : (
            <Shimmer className="text-sm">{label}</Shimmer>
          )}

          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9 w-[140px] text-xs" aria-label="Voice language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_LANGUAGES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={handsFree ? "default" : "outline"}
              size="sm"
              onClick={() => setHandsFree((value) => !value)}
            >
              {handsFree ? "Hands-free on" : "Hands-free off"}
            </Button>
          </div>

          {lastTurn ? (
            <div className="max-h-40 w-full space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
              {turns.slice(-6).map((turn, index) => (
                <p key={index} className={cn(turn.role === "user" && "text-muted-foreground")}>
                  <span className="font-medium">{turn.role === "user" ? "You: " : "Alaska: "}</span>
                  {turn.content}
                </p>
              ))}
            </div>
          ) : null}

          {turns.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setTurns([])}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear conversation
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
