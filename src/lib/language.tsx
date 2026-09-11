import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { VOICE_LANGUAGES, getVoiceLanguage } from "@/lib/voice-languages";

const STORAGE_KEY = "alaska-language";
const RTL = new Set(["ar"]);

type Dict = Record<string, string>;

/** UI strings, keyed by language code. English is the fallback. */
const STRINGS: Record<string, Dict> = {
  en: {
    "sidebar.previous": "Previous chats",
    "sidebar.newChat": "New chat",
    "sidebar.empty": "No conversations yet",
    "sidebar.alaskaChat": "Alaska Chat",
    "sidebar.chat": "Chat",
    "sidebar.chatHint": "Personal & groups",
    "sidebar.stories": "Stories",
    "sidebar.storiesHint": "Research updates",
    "sidebar.profile": "Profile",
    "sidebar.profileHint": "Bio, rules, settings",
    "sidebar.privacy": "Privacy & data",
    "sidebar.privacyHint": "Stored data & deletion",
    "sidebar.settings": "Settings",
    "sidebar.signOut": "Sign out",
    "chat.agenda": "What's on the agenda?",
    "chat.subtitle": "Ask anything, scan a page, or open a project.",
    "chat.placeholder": "Let's chat",
    "chat.copy": "Copy response",
    "chat.share": "Share response",
    "chat.readAloud": "Read aloud",
    "chat.thinking": "Alaska is thinking…",
    "settings.language": "Language",
    "settings.languageHint": "Used across the app and for Alaska's replies.",
  },
  es: {
    "sidebar.previous": "Chats anteriores",
    "sidebar.newChat": "Nuevo chat",
    "sidebar.empty": "Aún no hay conversaciones",
    "sidebar.alaskaChat": "Alaska Chat",
    "sidebar.chat": "Chat",
    "sidebar.chatHint": "Personal y grupos",
    "sidebar.stories": "Historias",
    "sidebar.storiesHint": "Novedades de investigación",
    "sidebar.profile": "Perfil",
    "sidebar.profileHint": "Bio y ajustes",
    "sidebar.privacy": "Privacidad y datos",
    "sidebar.privacyHint": "Datos guardados y borrado",
    "sidebar.settings": "Ajustes",
    "sidebar.signOut": "Cerrar sesión",
    "chat.agenda": "¿Qué tienes en mente?",
    "chat.subtitle": "Pregunta lo que sea, escanea una página o abre un proyecto.",
    "chat.placeholder": "Vamos a chatear",
    "chat.copy": "Copiar respuesta",
    "chat.share": "Compartir respuesta",
    "chat.readAloud": "Leer en voz alta",
    "chat.thinking": "Alaska está pensando…",
    "settings.language": "Idioma",
    "settings.languageHint": "Se usa en toda la app y en las respuestas de Alaska.",
  },
  fr: {
    "sidebar.previous": "Discussions précédentes",
    "sidebar.newChat": "Nouvelle discussion",
    "sidebar.empty": "Aucune conversation",
    "sidebar.alaskaChat": "Alaska Chat",
    "sidebar.chat": "Discussion",
    "sidebar.chatHint": "Personnel et groupes",
    "sidebar.stories": "Stories",
    "sidebar.storiesHint": "Actualités de recherche",
    "sidebar.profile": "Profil",
    "sidebar.profileHint": "Bio et réglages",
    "sidebar.privacy": "Confidentialité et données",
    "sidebar.privacyHint": "Données et suppression",
    "sidebar.settings": "Réglages",
    "sidebar.signOut": "Se déconnecter",
    "chat.agenda": "Quel est le programme ?",
    "chat.subtitle": "Posez une question, scannez une page ou ouvrez un projet.",
    "chat.placeholder": "Discutons",
    "chat.copy": "Copier la réponse",
    "chat.share": "Partager la réponse",
    "chat.readAloud": "Lire à voix haute",
    "chat.thinking": "Alaska réfléchit…",
    "settings.language": "Langue",
    "settings.languageHint": "Utilisée dans toute l'app et par Alaska.",
  },
  de: {
    "sidebar.previous": "Frühere Chats",
    "sidebar.newChat": "Neuer Chat",
    "sidebar.empty": "Noch keine Unterhaltungen",
    "sidebar.alaskaChat": "Alaska Chat",
    "sidebar.chat": "Chat",
    "sidebar.chatHint": "Persönlich & Gruppen",
    "sidebar.stories": "Stories",
    "sidebar.storiesHint": "Forschungs-Updates",
    "sidebar.profile": "Profil",
    "sidebar.profileHint": "Bio & Einstellungen",
    "sidebar.privacy": "Privatsphäre & Daten",
    "sidebar.privacyHint": "Daten & Löschung",
    "sidebar.settings": "Einstellungen",
    "sidebar.signOut": "Abmelden",
    "chat.agenda": "Was steht an?",
    "chat.subtitle": "Frag alles, scanne eine Seite oder öffne ein Projekt.",
    "chat.placeholder": "Lass uns chatten",
    "chat.copy": "Antwort kopieren",
    "chat.share": "Antwort teilen",
    "chat.readAloud": "Vorlesen",
    "chat.thinking": "Alaska denkt nach…",
    "settings.language": "Sprache",
    "settings.languageHint": "Gilt für die ganze App und Alaskas Antworten.",
  },
  hi: {
    "sidebar.previous": "पिछली चैट",
    "sidebar.newChat": "नई चैट",
    "sidebar.empty": "अभी कोई बातचीत नहीं",
    "sidebar.alaskaChat": "अलास्का चैट",
    "sidebar.chat": "चैट",
    "sidebar.chatHint": "व्यक्तिगत और समूह",
    "sidebar.stories": "स्टोरीज़",
    "sidebar.storiesHint": "रिसर्च अपडेट",
    "sidebar.profile": "प्रोफ़ाइल",
    "sidebar.profileHint": "बायो और सेटिंग्स",
    "sidebar.privacy": "प्राइवेसी और डेटा",
    "sidebar.privacyHint": "सहेजा डेटा और डिलीट",
    "sidebar.settings": "सेटिंग्स",
    "sidebar.signOut": "साइन आउट",
    "chat.agenda": "आज क्या करना है?",
    "chat.subtitle": "कुछ भी पूछें, पेज स्कैन करें या प्रोजेक्ट खोलें।",
    "chat.placeholder": "चलिए बात करते हैं",
    "chat.copy": "उत्तर कॉपी करें",
    "chat.share": "उत्तर साझा करें",
    "chat.readAloud": "पढ़कर सुनाएँ",
    "chat.thinking": "अलास्का सोच रहा है…",
    "settings.language": "भाषा",
    "settings.languageHint": "पूरे ऐप और अलास्का के उत्तरों के लिए।",
  },
  ar: {
    "sidebar.previous": "المحادثات السابقة",
    "sidebar.newChat": "محادثة جديدة",
    "sidebar.empty": "لا توجد محادثات بعد",
    "sidebar.alaskaChat": "دردشة ألاسكا",
    "sidebar.chat": "دردشة",
    "sidebar.chatHint": "فردية ومجموعات",
    "sidebar.stories": "القصص",
    "sidebar.storiesHint": "تحديثات البحث",
    "sidebar.profile": "الملف الشخصي",
    "sidebar.profileHint": "النبذة والإعدادات",
    "sidebar.privacy": "الخصوصية والبيانات",
    "sidebar.privacyHint": "البيانات المخزنة والحذف",
    "sidebar.settings": "الإعدادات",
    "sidebar.signOut": "تسجيل الخروج",
    "chat.agenda": "ما جدول اليوم؟",
    "chat.subtitle": "اسأل أي شيء، امسح صفحة، أو افتح مشروعًا.",
    "chat.placeholder": "لنتحدث",
    "chat.copy": "نسخ الرد",
    "chat.share": "مشاركة الرد",
    "chat.readAloud": "قراءة بصوت عالٍ",
    "chat.thinking": "ألاسكا تفكر…",
    "settings.language": "اللغة",
    "settings.languageHint": "تُستخدم في التطبيق بالكامل وفي ردود ألاسكا.",
  },
  zh: {
    "sidebar.previous": "历史对话",
    "sidebar.newChat": "新对话",
    "sidebar.empty": "暂无对话",
    "sidebar.alaskaChat": "Alaska 聊天",
    "sidebar.chat": "聊天",
    "sidebar.chatHint": "私聊与群组",
    "sidebar.stories": "动态",
    "sidebar.storiesHint": "研究更新",
    "sidebar.profile": "个人资料",
    "sidebar.profileHint": "简介与设置",
    "sidebar.privacy": "隐私与数据",
    "sidebar.privacyHint": "存储数据与删除",
    "sidebar.settings": "设置",
    "sidebar.signOut": "退出登录",
    "chat.agenda": "今天想聊点什么？",
    "chat.subtitle": "随便提问、扫描页面或打开项目。",
    "chat.placeholder": "开始聊天",
    "chat.copy": "复制回复",
    "chat.share": "分享回复",
    "chat.readAloud": "朗读",
    "chat.thinking": "Alaska 正在思考…",
    "settings.language": "语言",
    "settings.languageHint": "应用于整个应用和 Alaska 的回复。",
  },
};

type LanguageContextValue = {
  language: string;
  setLanguage: (code: string) => void;
  locale: string;
  label: string;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VOICE_LANGUAGES.some((item) => item.code === stored)) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const meta = getVoiceLanguage(language);
    const dir: "ltr" | "rtl" = RTL.has(meta.code) ? "rtl" : "ltr";
    const dict = STRINGS[meta.code] ?? STRINGS["en"]!;
    return {
      language: meta.code,
      setLanguage,
      locale: meta.locale,
      label: meta.label,
      dir,
      t: (key: string) => dict[key] ?? STRINGS["en"]![key] ?? key,
    };
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = value.language;
    document.documentElement.dir = value.dir;
  }, [value.language, value.dir]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
