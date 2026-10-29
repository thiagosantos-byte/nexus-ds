/**
 * Tradutor oficial VLibras (governo federal brasileiro).
 * Carregado apenas quando a pessoa ativa o recurso, para não pesar a página.
 */
const SCRIPT_URL = "https://vlibras.gov.br/app/vlibras-plugin.js";
const WIDGET_URL = "https://vlibras.gov.br/app";
const CONTAINER_ID = "nexus-vlibras";

type VlibrasWindow = Window & {
  VLibras?: { Widget: new (url: string) => unknown };
  vlibrasLoaded?: boolean;
};

let loading: Promise<boolean> | null = null;

function ensureContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    (container as HTMLElement & { vw?: string }).setAttribute("vw", "");
    (container as HTMLElement & { vw?: string }).className = "enabled";
    container.innerHTML =
      '<div vw-access-button class="active"></div>' +
      '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    document.body.appendChild(container);
  }
  return container;
}

export function loadVlibras(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const container = ensureContainer();
    container.style.display = "";
    const win = window as VlibrasWindow;
    const start = () => {
      try {
        if (win.vlibrasLoaded) {
          resolve(true);
          return;
        }
        if (!win.VLibras) {
          resolve(false);
          return;
        }
        new win.VLibras.Widget(WIDGET_URL);
        win.vlibrasLoaded = true;
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    if (win.VLibras) {
      start();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", start, { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", start, { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.body.appendChild(script);
  });
  return loading;
}

export function setVlibrasVisible(visible: boolean) {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;
  container.style.display = visible ? "" : "none";
}
