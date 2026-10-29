import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useAccessibility } from "../accessibility/AccessibilityProvider";
import type { WorkspaceData } from "../workspace/types";
import { buildInsights, localAnswer, workspaceSnapshot } from "./insights";
import "./nexus-ai.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "local";
  suggestions?: string[];
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;

function greeting(roleLabel?: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return `${part}${roleLabel ? `, ${roleLabel.toLowerCase()}` : ""}. Sou a Nexus IA. Analiso os dados que você já pode ver e ajudo a decidir o próximo passo — sem inventar números.`;
}

export function NexusAI({
  data,
  token,
  roleLabel,
  variant = "floating",
}: {
  data: WorkspaceData | null;
  token: string;
  roleLabel?: string;
  variant?: "floating" | "inline";
}) {
  const { preferences, speak, stopSpeaking, speaking, announce, speechSupported } =
    useAccessibility();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const id = useId();
  const suggestions = data
    ? buildInsights(data)
        .slice(0, 3)
        .map((insight) => insight.prompt)
    : ["Como funciona o Nexus?", "Como usar os recursos de acessibilidade?"];

  useEffect(() => {
    if (open) {
      setMessages((current) =>
        current.length
          ? current
          : [
              {
                id: "welcome",
                role: "assistant",
                content: greeting(roleLabel),
                source: "local",
              },
            ],
      );
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, roleLabel]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyK") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const ask = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      if (prompt) {
        setInput(prompt);
        window.setTimeout(() => inputRef.current?.focus(), 80);
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("nexus:ask", ask);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("nexus:ask", ask);
    };
  }, []);

  useEffect(
    () => () => {
      recognition.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  async function send(text = input) {
    const question = text.trim();
    if (!question || busy) return;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusy(true);
    announce("Pergunta enviada para a Nexus IA.");
    const history = [...messages, userMessage]
      .filter((message) => message.id !== "welcome")
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));
    try {
      // A prévia standalone é um arquivo local; não há API para consultar.
      if (window.location.protocol === "file:") throw new Error("local");
      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history,
          context: data ? workspaceSnapshot(data) : null,
        }),
      });
      if (!response.ok) throw new Error("local");
      const body = (await response.json()) as {
        reply?: string;
        source?: "ai" | "local";
        suggestions?: string[];
      };
      if (!body.reply) throw new Error("local");
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: body.reply!,
          source: body.source === "ai" ? "ai" : "local",
          suggestions: body.suggestions,
        },
      ]);
      announce("A Nexus IA respondeu.");
    } catch {
      // Sem provedor de IA configurado: responde localmente com os dados reais.
      const fallback = data
        ? localAnswer(question, data)
        : {
            answer:
              "Selecione uma instituição para que eu possa analisar projetos, bancas, avaliações e resultados. Também posso explicar como usar cada recurso do Nexus.",
            suggestions: [
              "Como usar os recursos de acessibilidade?",
              "O que é a Nexus IA?",
            ],
          };
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: fallback.answer,
          source: "local",
          suggestions: fallback.suggestions,
        },
      ]);
      announce("A Nexus IA respondeu usando os dados deste contexto.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const ctor = (
      window as unknown as {
        SpeechRecognition?: RecognitionConstructor;
        webkitSpeechRecognition?: RecognitionConstructor;
      }
    ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: RecognitionConstructor;
        }
      ).webkitSpeechRecognition;
    if (!ctor) {
      announce("Ditado por voz indisponível neste navegador. Use o teclado.", "assertive");
      return;
    }
    const instance = new ctor();
    instance.lang = "pt-BR";
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput((current) => `${current} ${transcript}`.trim());
      announce("Fala transcrita. Revise e envie.");
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => {
      setListening(false);
      announce("Não foi possível ouvir. Tente novamente ou digite.", "assertive");
    };
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
      announce("Microfone ativo. Fale agora.");
    } catch {
      setListening(false);
    }
  }

  function readAloud(content: string) {
    if (speaking) {
      stopSpeaking();
      return;
    }
    speak(content.replace(/[•*#]/g, ""));
  }

  const panel = (
    <div className="nexus-ai-surface">
      <header className="nexus-ai-head">
        <span className="nexus-ai-orb" aria-hidden="true">
          <Sparkles size={19} />
        </span>
        <div>
          <strong>Nexus IA</strong>
          <span className="nexus-ai-status">
            {data ? `Analisando ${data.institution.name}` : "Assistente do sistema"}
          </span>
        </div>
        {variant === "floating" && (
          <button
            type="button"
            className="nexus-ai-icon"
            onClick={() => setOpen(false)}
            aria-label="Fechar Nexus IA"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <div
        className="nexus-ai-log"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversa com a Nexus IA"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`nexus-ai-message ${message.role} ${message.source === "local" ? "local" : ""}`}
          >
            {message.role === "assistant" && (
              <span className="nexus-ai-avatar" aria-hidden="true">
                <Bot size={16} />
              </span>
            )}
            <div className="nexus-ai-bubble">
              {message.content.split("\n").map((line, index) =>
                line.trim() ? <p key={index}>{line}</p> : null,
              )}
              {message.role === "assistant" && (
                <div className="nexus-ai-message-tools">
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={() => readAloud(message.content)}
                      aria-label={
                        speaking ? "Parar leitura da resposta" : "Ouvir esta resposta"
                      }
                      className="nexus-ai-tool"
                    >
                      {speaking ? <Square size={13} /> : <Volume2 size={14} />}
                      {speaking ? "Parar" : "Ouvir"}
                    </button>
                  )}
                  <span className="nexus-ai-source">
                    {message.source === "ai"
                      ? "Gerada com IA"
                      : "Dados do seu contexto"}
                  </span>
                </div>
              )}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="nexus-ai-suggestions">
                  {message.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      disabled={busy}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
        {busy && (
          <p className="nexus-ai-thinking" role="status">
            <Loader2 size={15} className="spin" aria-hidden="true" />
            Analisando os dados do seu contexto…
          </p>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="nexus-ai-starters" aria-label="Sugestões de perguntas">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              disabled={busy}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="nexus-ai-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Pergunte à Nexus IA
        </label>
        <textarea
          id={`${id}-input`}
          ref={inputRef}
          rows={2}
          value={input}
          placeholder="Pergunte sobre prazos, notas, projetos…"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="nexus-ai-actions">
          <button
            type="button"
            className="nexus-ai-icon"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? "Parar ditado por voz" : "Ditar pergunta por voz"}
            title="Ditado por voz"
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            type="submit"
            className="nexus-ai-send"
            disabled={busy || !input.trim()}
            aria-label="Enviar pergunta"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>

      <p className="nexus-ai-foot">
        {preferences.captions
          ? "Legendas ativas: cada resposta fica escrita e pode ser ouvida."
          : "Respostas usam apenas os dados que seu perfil já pode ver."}
        {" · "}
        <button
          type="button"
          className="nexus-ai-link"
          onClick={() => window.dispatchEvent(new CustomEvent("nexus:a11y"))}
        >
          Ajustar acessibilidade
        </button>
      </p>
    </div>
  );

  if (variant === "inline") return panel;

  return (
    <>
      <button
        type="button"
        className="nexus-ai-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Nexus IA (Alt+Shift+K)"
      >
        <span className="nexus-ai-launcher-orb" aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <span>
          <strong>Nexus IA</strong>
          <small>Pergunte sobre seus dados</small>
        </span>
      </button>
      <dialog
        ref={dialog}
        className="nexus-ai-dialog"
        aria-labelledby={`${id}-title`}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <h2 id={`${id}-title`} className="sr-only">
          Nexus IA
        </h2>
        {panel}
      </dialog>
    </>
  );
}
