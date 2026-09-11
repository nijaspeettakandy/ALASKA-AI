export type VoiceLanguage = {
  /** ISO-639-1 code sent to the transcription model */
  code: string;
  /** BCP-47 tag used by speech synthesis */
  locale: string;
  label: string;
};

/** The 7 main languages supported by live voice reply. */
export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "en", locale: "en-US", label: "English" },
  { code: "es", locale: "es-ES", label: "Español" },
  { code: "fr", locale: "fr-FR", label: "Français" },
  { code: "de", locale: "de-DE", label: "Deutsch" },
  { code: "hi", locale: "hi-IN", label: "हिन्दी" },
  { code: "ar", locale: "ar-SA", label: "العربية" },
  { code: "zh", locale: "zh-CN", label: "中文" },
];

export const getVoiceLanguage = (code: string): VoiceLanguage =>
  VOICE_LANGUAGES.find((language) => language.code === code) ?? VOICE_LANGUAGES[0]!;
