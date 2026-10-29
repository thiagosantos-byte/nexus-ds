import { useEffect, useId, useRef, useState } from "react";
import {
  Accessibility,
  AudioLines,
  Captions,
  Check,
  Eye,
  Keyboard,
  MonitorSmartphone,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import { useAccessibility, type ColorFilter } from "./AccessibilityProvider";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { loadVlibras } from "./vlibras";

type Tab = "visao" | "cores" | "audicao" | "fala" | "teclado";

const tabs: Array<{ id: Tab; label: string; icon: typeof Eye }> = [
  { id: "visao", label: "Visão", icon: Eye },
  { id: "cores", label: "Daltonismo", icon: Palette },
  { id: "audicao", label: "Audição", icon: Captions },
  { id: "fala", label: "Fala e voz", icon: AudioLines },
  { id: "teclado", label: "Teclado", icon: Keyboard },
];

const filters: Array<{
  value: ColorFilter;
  label: string;
  description: string;
  swatches: string[];
}> = [
  {
    value: "none",
    label: "Cores originais",
    description: "Mantém a paleta da instituição.",
    swatches: ["#163d49", "#a4e3d1", "#c9a227", "#9e353d"],
  },
  {
    value: "protanopia",
    label: "Protanopia",
    description: "Reforça a separação entre vermelhos e verdes.",
    swatches: ["#1c4b57", "#8fd0c0", "#d8a227", "#2f6fae"],
  },
  {
    value: "deuteranopia",
    label: "Deuteranopia",
    description: "Ajusta vermelhos e verdes para maior contraste.",
    swatches: ["#1d5360", "#9edcc6", "#e0b13a", "#3a72b8"],
  },
  {
    value: "tritanopia",
    label: "Tritanopia",
    description: "Separa azuis de verdes e amarelos.",
    swatches: ["#3d3a54", "#c9d3a4", "#d9a3b6", "#4f7f9e"],
  },
  {
    value: "achromatopsia",
    label: "Acromatopsia",
    description: "Escala de cinza com texto sempre legível.",
    swatches: ["#2b2b2b", "#c9c9c9", "#8a8a8a", "#f2f2f2"],
  },
];

export function AccessibilityPanel({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const { preferences, theme, update, reset, announce } = useAccessibility();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  const [tab, setTab] = useState<Tab>("visao");
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyA") {
        e.preventDefault();
        setLocalOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function change(patch: Parameters<typeof update>[0], message: string) {
    update(patch);
    announce(message);
  }

  return (
    <>
      {controlledOpen === undefined && (
        <div className="accessibility-tools">
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            onClick={() =>
              change(
                { theme: theme === "dark" ? "light" : "dark" },
                theme === "dark" ? "Tema claro ativado." : "Tema escuro ativado.",
              )
            }
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button
            ref={trigger}
            variant="ghost"
            aria-label="Opções de acessibilidade"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <Accessibility />
            <span>Acessibilidade</span>
          </Button>
        </div>
      )}
      <dialog
        ref={ref}
        className="accessibility-dialog nexus-a11y-dialog"
        aria-labelledby={id}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className="section-head">
          <div>
            <span className="eyebrow">NEXUS ACESSÍVEL</span>
            <h2 id={id}>Do seu jeito, para todos</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar opções de acessibilidade"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <p className="a11y-intro">
          Combine os recursos. Tudo fica salvo neste navegador e pode ser
          alterado a qualquer momento.
        </p>

        <div className="a11y-tabs" role="tablist" aria-label="Categorias de acessibilidade">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`${id}-tab-${tabId}`}
              aria-selected={tab === tabId}
              aria-controls={`${id}-panel-${tabId}`}
              tabIndex={tab === tabId ? 0 : -1}
              className={`a11y-tab ${tab === tabId ? "active" : ""}`}
              onClick={() => setTab(tabId)}
              onKeyDown={(event) => {
                const index = tabs.findIndex((t) => t.id === tab);
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next =
                    (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                    tabs.length;
                  setTab(tabs[next].id);
                  document
                    .getElementById(`${id}-tab-${tabs[next].id}`)
                    ?.focus();
                }
              }}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel-${tab}`}
          aria-labelledby={`${id}-tab-${tab}`}
          className="a11y-tab-panel"
        >
          {tab === "visao" && (
            <>
              <div className="accessibility-option">
                <Label htmlFor={`${id}-theme`}>Aparência</Label>
                <select
                  id={`${id}-theme`}
                  value={preferences.theme}
                  onChange={(e) =>
                    change(
                      { theme: e.target.value as typeof preferences.theme },
                      "Aparência atualizada.",
                    )
                  }
                >
                  <option value="system">Acompanhar o dispositivo</option>
                  <option value="light">Clara</option>
                  <option value="dark">Escura</option>
                </select>
              </div>
              <SwitchRow
                id={`${id}-contrast`}
                label="Contraste reforçado"
                help="Texto, bordas e foco com contraste mínimo de 7:1."
                checked={preferences.highContrast}
                onChange={(highContrast) =>
                  change(
                    { highContrast },
                    highContrast
                      ? "Contraste reforçado ativado."
                      : "Contraste padrão restaurado.",
                  )
                }
              />
              <SwitchRow
                id={`${id}-text`}
                label="Texto ampliado"
                help="Aumenta o tamanho do texto e a altura das linhas."
                checked={preferences.largeText}
                onChange={(largeText) =>
                  change(
                    { largeText },
                    largeText ? "Texto ampliado ativado." : "Texto padrão restaurado.",
                  )
                }
              />
              <SwitchRow
                id={`${id}-dyslexia`}
                label="Fonte de alta legibilidade"
                help="Letras mais espaçadas, indicadas para dislexia e baixa visão."
                checked={preferences.dyslexiaFont}
                onChange={(dyslexiaFont) =>
                  change(
                    { dyslexiaFont },
                    dyslexiaFont
                      ? "Fonte de alta legibilidade ativada."
                      : "Fonte padrão restaurada.",
                  )
                }
              />
              <SwitchRow
                id={`${id}-links`}
                label="Sublinhar todos os links"
                help="Links ficam identificáveis sem depender apenas da cor."
                checked={preferences.underlineLinks}
                onChange={(underlineLinks) =>
                  change({ underlineLinks }, "Preferência de links atualizada.")
                }
              />
              <SwitchRow
                id={`${id}-guide`}
                label="Régua de leitura"
                help="Uma faixa destaca a linha em que você está lendo."
                checked={preferences.readingGuide}
                onChange={(readingGuide) =>
                  change({ readingGuide }, "Régua de leitura atualizada.")
                }
              />
              <SwitchRow
                id={`${id}-calm`}
                label="Modo tranquilo"
                help="Reduz animações, brilhos e movimentos."
                checked={preferences.calm}
                onChange={(calm) => change({ calm }, "Modo tranquilo atualizado.")}
              />
              <SwitchRow
                id={`${id}-reader`}
                label="Modo leitor de tela"
                help="Reforça marcos, dicas de navegação e anúncios de página."
                checked={preferences.screenReader}
                onChange={(screenReader) =>
                  change(
                    { screenReader },
                    screenReader
                      ? "Modo leitor de tela ativado."
                      : "Modo leitor de tela desativado.",
                  )
                }
              />
            </>
          )}

          {tab === "cores" && (
            <>
              <fieldset className="a11y-swatches">
                <legend>Ajuste de cores</legend>
                {filters.map((option) => (
                  <label
                    key={option.value}
                    className={`a11y-swatch ${preferences.filter === option.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`${id}-filter`}
                      value={option.value}
                      checked={preferences.filter === option.value}
                      onChange={() =>
                        change(
                          { filter: option.value },
                          `Ajuste de cores: ${option.label}.`,
                        )
                      }
                    />
                    <span className="a11y-swatch-colors" aria-hidden="true">
                      {option.swatches.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    <span className="a11y-swatch-text">
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </span>
                    {preferences.filter === option.value && (
                      <Check size={18} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </fieldset>
              <SwitchRow
                id={`${id}-safe`}
                label="Paleta segura para daltonismo"
                help="Troca as cores de gráficos por uma paleta testada (Okabe–Ito)."
                checked={preferences.safePalette}
                onChange={(safePalette) =>
                  change(
                    { safePalette },
                    safePalette
                      ? "Paleta segura ativada."
                      : "Paleta da instituição restaurada.",
                  )
                }
              />
              <SwitchRow
                id={`${id}-patterns`}
                label="Formas e padrões nos gráficos"
                help="Cada série recebe um padrão e um símbolo. A cor nunca é a única pista."
                checked={preferences.patterns}
                onChange={(patterns) =>
                  change(
                    { patterns },
                    patterns
                      ? "Padrões de identificação ativados."
                      : "Padrões desativados.",
                  )
                }
              />
              <p className="a11y-note">
                Os ajustes de cor não alteram os dados. Sempre que a cor indica
                algo, o Nexus também mostra texto, ícone ou rótulo.
              </p>
            </>
          )}

          {tab === "audicao" && (
            <>
              <SwitchRow
                id={`${id}-captions`}
                label="Legendas e transcrições"
                help="Exibe texto ao vivo em premiações e conteúdos com áudio."
                checked={preferences.captions}
                onChange={(captions) =>
                  change(
                    { captions },
                    captions
                      ? "Legendas visuais ativadas."
                      : "Legendas visuais desativadas.",
                  )
                }
              />
              <SwitchRow
                id={`${id}-libras`}
                label="Tradução em LIBRAS"
                help="Carrega o tradutor VLibras oficial do governo brasileiro."
                checked={preferences.libras}
                onChange={async (libras) => {
                  update({ libras });
                  if (libras) {
                    const loaded = await loadVlibras();
                    announce(
                      loaded
                        ? "Tradutor de LIBRAS carregado. Use o botão azul na tela."
                        : "Não foi possível carregar o VLibras. Verifique a conexão.",
                      loaded ? "polite" : "assertive",
                    );
                  } else {
                    announce("Tradutor de LIBRAS desativado.");
                  }
                }}
              />
              <div className="a11y-note">
                <strong>Alertas sem som</strong>
                <p>
                  Erros e avisos do sistema usam texto, ícone e anúncio para
                  leitores de tela. Nenhuma informação depende de um som.
                </p>
              </div>
              <div className="a11y-note">
                <strong>Atalho de legendas</strong>
                <p>
                  Pressione <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>{" "}
                  para ligar ou desligar legendas em qualquer tela.
                </p>
              </div>
            </>
          )}

          {tab === "fala" && (
            <>
              <SwitchRow
                id={`${id}-speak`}
                label="Voz sob demanda"
                help="Mostra o botão “Ouvir” em textos e respostas da Nexus IA."
                checked={preferences.speakOnDemand}
                onChange={(speakOnDemand) =>
                  change(
                    { speakOnDemand },
                    speakOnDemand
                      ? "Botões de leitura em voz alta ativados."
                      : "Leitura em voz alta desativada.",
                  )
                }
              />
              <div className="a11y-note">
                <strong>Comunicação sem voz</strong>
                <p>
                  A Nexus IA aceita perguntas por texto e pode ler as respostas
                  em voz alta. O quadro de frases rápidas ajuda em atendimentos
                  e reuniões.
                </p>
              </div>
              <div className="a11y-note">
                <strong>Privacidade do microfone</strong>
                <p>
                  O ditado por voz é opcional, funciona no seu navegador e nunca
                  é gravado pelo Nexus.
                </p>
              </div>
            </>
          )}

          {tab === "teclado" && (
            <>
              <div className="shortcut-note">
                <strong>Atalhos do Nexus</strong>
                <dl className="a11y-shortcuts">
                  <div>
                    <dt><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd></dt>
                    <dd>Abrir este painel</dd>
                  </div>
                  <div>
                    <dt><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd></dt>
                    <dd>Abrir a Nexus IA</dd>
                  </div>
                  <div>
                    <dt><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd></dt>
                    <dd>Alternar legendas</dd>
                  </div>
                  <div>
                    <dt><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd></dt>
                    <dd>Ir ao conteúdo principal</dd>
                  </div>
                  <div>
                    <dt><kbd>Esc</kbd></dt>
                    <dd>Fechar painéis</dd>
                  </div>
                </dl>
              </div>
              <SwitchRow
                id={`${id}-reader-2`}
                label="Dicas de foco ampliadas"
                help="Anuncia o nome do bloco ao navegar com Tab."
                checked={preferences.screenReader}
                onChange={(screenReader) =>
                  change({ screenReader }, "Dicas de navegação atualizadas.")
                }
              />
              <p className="a11y-note">
                Todo o sistema funciona sem mouse. Botões têm no mínimo 44 px e
                o foco nunca fica escondido.
              </p>
            </>
          )}
        </div>

        <div className="a11y-panel-footer">
          <Button variant="ghost" onClick={() => {
            reset();
            announce("Preferências de acessibilidade restauradas.");
          }}>
            <RotateCcw />
            Restaurar
          </Button>
          <span className="a11y-footer-hint">
            <MonitorSmartphone size={15} aria-hidden="true" /> Salvo neste
            navegador
          </span>
        </div>
      </dialog>

      <svg className="color-filter-definitions" aria-hidden="true">
        <defs>
          <filter id="color-protanopia" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values=".8 .2 0 0 0  .15 .85 0 0 0  .15 -.15 1 0 0  0 0 0 1 0"
            />
          </filter>
          <filter id="color-deuteranopia" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 .15 -.15 0 0  .15 .8 .05 0 0  0 .2 .8 0 0  0 0 0 1 0"
            />
          </filter>
          <filter id="color-tritanopia" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values=".9 .1 0 0 0  0 .9 .1 0 0  .15 .15 .7 0 0  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}

function SwitchRow({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="accessibility-switch">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-help`}>{help}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-help`}
      />
    </div>
  );
}

export function ReadingGuide() {
  const { preferences } = useAccessibility();
  const [y, setY] = useState(0);
  useEffect(() => {
    if (!preferences.readingGuide) return;
    const move = (event: PointerEvent) => setY(event.clientY);
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [preferences.readingGuide]);
  if (!preferences.readingGuide) return null;
  return (
    <div
      className="reading-guide"
      aria-hidden="true"
      style={{ transform: `translateY(${Math.max(0, y - 26)}px)` }}
    >
      <span />
    </div>
  );
}

export function CaptionsShortcut() {
  const { preferences, update, announce } = useAccessibility();
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyC") {
        event.preventDefault();
        update({ captions: !preferences.captions });
        announce(
          preferences.captions
            ? "Legendas desativadas."
            : "Legendas ativadas.",
        );
      }
      if (event.altKey && event.shiftKey && event.code === "KeyL") {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preferences.captions, update, announce]);
  return null;
}

