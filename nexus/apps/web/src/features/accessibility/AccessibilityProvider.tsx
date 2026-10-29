import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ColorFilter =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

export type Preferences = {
  theme: "system" | "light" | "dark";
  calm: boolean;
  largeText: boolean;
  filter: ColorFilter;
  /** Paleta categórica segura (Okabe–Ito) usada em gráficos e status. */
  safePalette: boolean;
  /** Reforça informação com padrões e formas, nunca só cor. */
  patterns: boolean;
  /** Fonte de alta legibilidade (dislexia). */
  dyslexiaFont: boolean;
  underlineLinks: boolean;
  /** Régua de leitura que acompanha o ponteiro/foco. */
  readingGuide: boolean;
  /** Modo leitor de tela: anúncios extras e dicas de navegação. */
  screenReader: boolean;
  /** Legendas visuais para todo conteúdo com áudio. */
  captions: boolean;
  /** Tradutor de LIBRAS (VLibras). */
  libras: boolean;
  /** Voz sintetizada para quem prefere ou precisa ouvir. */
  speakOnDemand: boolean;
  /** Contraste reforçado (WCAG AAA). */
  highContrast: boolean;
};

const initial: Preferences = {
  theme: "system",
  calm: false,
  largeText: false,
  filter: "none",
  safePalette: false,
  patterns: false,
  dyslexiaFont: false,
  underlineLinks: false,
  readingGuide: false,
  screenReader: false,
  captions: false,
  libras: false,
  speakOnDemand: false,
  highContrast: false,
};

const storageKey = "nexus:accessibility:v2";
const legacyKeys = ["catapimba:accessibility:v1"];

type AccessibilityContextValue = {
  preferences: Preferences;
  theme: "light" | "dark";
  reduceMotion: boolean;
  update: (v: Partial<Preferences>) => void;
  reset: () => void;
  /** Anuncia uma mensagem para leitores de tela. */
  announce: (message: string, priority?: "polite" | "assertive") => void;
  /** Lê um texto em voz alta (Web Speech API). */
  speak: (text: string) => void;
  stopSpeaking: () => void;
  speaking: boolean;
  speechSupported: boolean;
};

const Context = createContext<AccessibilityContextValue | null>(null);

function sanitize(raw: unknown): Preferences {
  const v = (raw ?? {}) as Record<string, unknown>;
  const bool = (key: keyof Preferences) => v[key] === true;
  return {
    theme: ["system", "light", "dark"].includes(String(v.theme))
      ? (v.theme as Preferences["theme"])
      : "system",
    calm: bool("calm"),
    largeText: bool("largeText"),
    filter: [
      "none",
      "protanopia",
      "deuteranopia",
      "tritanopia",
      "achromatopsia",
    ].includes(String(v.filter))
      ? (v.filter as ColorFilter)
      : "none",
    safePalette: bool("safePalette"),
    patterns: bool("patterns"),
    dyslexiaFont: bool("dyslexiaFont"),
    underlineLinks: bool("underlineLinks"),
    readingGuide: bool("readingGuide"),
    screenReader: bool("screenReader"),
    captions: bool("captions"),
    libras: bool("libras"),
    speakOnDemand: bool("speakOnDemand"),
    highContrast: bool("highContrast"),
  };
}

function read(): Preferences {
  try {
    const current = localStorage.getItem(storageKey);
    if (current) return sanitize(JSON.parse(current));
    // Migra preferências da marca anterior sem perder escolhas do usuário.
    for (const key of legacyKeys) {
      const legacy = localStorage.getItem(key);
      if (legacy) return sanitize(JSON.parse(legacy));
    }
    return initial;
  } catch {
    return initial;
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(read);
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    const color = matchMedia("(prefers-color-scheme: dark)"),
      motion = matchMedia("(prefers-reduced-motion: reduce)");
    const onColor = () => setDark(color.matches),
      onMotion = () => setSystemReduced(motion.matches);
    color.addEventListener("change", onColor);
    motion.addEventListener("change", onMotion);
    return () => {
      color.removeEventListener("change", onColor);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  const theme =
    preferences.theme === "system"
      ? dark
        ? "dark"
        : "light"
      : preferences.theme;
  const reduceMotion = systemReduced || preferences.calm;

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.classList.toggle("dark", theme === "dark");
    html.dataset.calm = String(preferences.calm);
    html.dataset.largeText = String(preferences.largeText);
    html.dataset.colorFilter = preferences.filter;
    html.dataset.reducedMotion = String(reduceMotion);
    html.dataset.safePalette = String(preferences.safePalette);
    html.dataset.patterns = String(preferences.patterns);
    html.dataset.dyslexia = String(preferences.dyslexiaFont);
    html.dataset.underlineLinks = String(preferences.underlineLinks);
    html.dataset.readingGuide = String(preferences.readingGuide);
    html.dataset.screenReader = String(preferences.screenReader);
    html.dataset.captions = String(preferences.captions);
    html.dataset.libras = String(preferences.libras);
    html.dataset.highContrast = String(preferences.highContrast);
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      legacyKeys.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* Preferences remain usable without storage. */
    }
  }, [preferences, theme, reduceMotion]);

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      // Limpar antes garante que mensagens repetidas voltem a ser anunciadas.
      if (priority === "assertive") {
        setAssertiveMessage("");
        window.setTimeout(() => setAssertiveMessage(message), 40);
      } else {
        setPoliteMessage("");
        window.setTimeout(() => setPoliteMessage(message), 40);
      }
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1;
      utterance.pitch = 1;
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => /pt-BR|pt_BR|Portuguese/i.test(`${v.lang} ${v.name}`));
      if (voice) utterance.voice = voice;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      preferences,
      theme,
      reduceMotion,
      update: (v) => setPreferences((p) => ({ ...p, ...v })),
      reset: () => setPreferences(initial),
      announce,
      speak,
      stopSpeaking,
      speaking,
      speechSupported,
    }),
    [preferences, theme, reduceMotion, announce, speak, stopSpeaking, speaking, speechSupported],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertiveMessage}
      </div>
    </Context.Provider>
  );
}

export function useAccessibility() {
  const value = useContext(Context);
  if (!value) throw new Error("AccessibilityProvider ausente");
  return value;
}
