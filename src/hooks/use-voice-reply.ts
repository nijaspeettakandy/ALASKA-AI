import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceLanguage } from "@/lib/voice-languages";

/**
 * Speaks assistant replies out loud with the browser speech engine,
 * in the currently selected language.
 */
export function useVoiceReply(enabled: boolean, languageCode: string) {
  const [speaking, setSpeaking] = useState(false);
  const spokenRef = useRef<Set<string>>(new Set());

  const supported = typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      const language = getVoiceLanguage(languageCode);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utterance.lang = language.locale;
      const match = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang?.toLowerCase().startsWith(language.code));
      if (match) utterance.voice = match;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [languageCode, supported],
  );

  /** Speak a completed assistant message exactly once. */
  const speakOnce = useCallback(
    (id: string, text: string) => {
      if (!enabled || spokenRef.current.has(id)) return;
      spokenRef.current.add(id);
      speak(text);
    },
    [enabled, speak],
  );

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  return { supported, speaking, speak, speakOnce, stop };
}
