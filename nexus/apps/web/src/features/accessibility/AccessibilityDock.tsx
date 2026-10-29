import { Accessibility, Captions, Hand, MessageSquareText, Square, Volume2 } from "lucide-react";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { useAccessibility } from "./AccessibilityProvider";
import { loadVlibras, setVlibrasVisible } from "./vlibras";
import { useEffect, useState } from "react";

/**
 * Barra flutuante única: configurações + atalhos de LIBRAS, legendas e voz.
 * Pensada para mouse, toque e teclado (todos os alvos com 44 px).
 */
export function AccessibilityDock() {
  const { preferences, update, announce, speak, stopSpeaking, speaking, speechSupported } =
    useAccessibility();
  const [panelOpen, setPanelOpen] = useState(false);
  const [librasReady, setLibrasReady] = useState(false);

  useEffect(() => {
    const openPanel = () => setPanelOpen(true);
    window.addEventListener("nexus:a11y", openPanel);
    return () => window.removeEventListener("nexus:a11y", openPanel);
  }, []);

  useEffect(() => {
    if (!preferences.libras) {
      setVlibrasVisible(false);
      return;
    }
    void loadVlibras().then((loaded) => {
      setLibrasReady(loaded);
      setVlibrasVisible(loaded);
    });
  }, [preferences.libras]);

  function readPage() {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const main = document.getElementById("main-content") ?? document.body;
    const text = (main.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2400);
    if (!text) {
      announce("Nada para ler nesta página.", "assertive");
      return;
    }
    speak(text);
    announce("Lendo o conteúdo da página em voz alta.");
  }

  return (
    <>
      <div className="nexus-a11y-dock" role="group" aria-label="Recursos de acessibilidade">
        <button
          type="button"
          className="dock-button"
          aria-pressed={preferences.libras}
          onClick={async () => {
            const next = !preferences.libras;
            update({ libras: next });
            if (next) {
              const loaded = await loadVlibras();
              setLibrasReady(loaded);
              setVlibrasVisible(loaded);
              announce(
                loaded
                  ? "LIBRAS ativado. Use o botão azul do VLibras na tela."
                  : "O VLibras não pôde ser carregado agora.",
                loaded ? "polite" : "assertive",
              );
            } else {
              setVlibrasVisible(false);
              announce("LIBRAS desativado.");
            }
          }}
          title="Tradução em LIBRAS (VLibras)"
        >
          <Hand size={19} aria-hidden="true" />
          <span className="dock-label">LIBRAS</span>
          {preferences.libras && (
            <span className="dock-dot" aria-label={librasReady ? "Ativo" : "Carregando"} />
          )}
        </button>
        <button
          type="button"
          className="dock-button"
          aria-pressed={preferences.captions}
          onClick={() => {
            update({ captions: !preferences.captions });
            announce(
              preferences.captions
                ? "Legendas desativadas."
                : "Legendas visuais ativadas.",
            );
          }}
          title="Legendas e transcrições"
        >
          <Captions size={19} aria-hidden="true" />
          <span className="dock-label">Legendas</span>
        </button>
        {speechSupported && (
          <button
            type="button"
            className="dock-button"
            aria-pressed={speaking}
            onClick={readPage}
            title={speaking ? "Parar leitura" : "Ouvir o conteúdo desta página"}
          >
            {speaking ? (
              <Square size={18} aria-hidden="true" />
            ) : (
              <Volume2 size={19} aria-hidden="true" />
            )}
            <span className="dock-label">{speaking ? "Parar" : "Ouvir"}</span>
          </button>
        )}
        <button
          type="button"
          className="dock-button dock-settings"
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(true)}
          title="Todas as opções de acessibilidade (Alt+Shift+A)"
        >
          <Accessibility size={20} aria-hidden="true" />
          <span className="dock-label">Acessibilidade</span>
        </button>
      </div>

      <AccessibilityPanel open={panelOpen} onOpenChange={setPanelOpen} />

      {preferences.screenReader && (
        <p className="sr-only" aria-live="polite">
          Modo leitor de tela ativo. Use Tab para navegar entre blocos e o
          atalho Alt Shift A para ajustar preferências.
        </p>
      )}
      <span className="sr-only">
        <MessageSquareText aria-hidden="true" />
      </span>
    </>
  );
}
