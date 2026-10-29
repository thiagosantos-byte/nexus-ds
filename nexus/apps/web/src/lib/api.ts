/** All application requests use the same API origin. No Supabase secrets belong here. */
const origin = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
if (origin) {
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error(
      "VITE_API_URL deve ser uma origem HTTPS, sem caminho ou credenciais.",
    );
  }
}
export function apiUrl(path: string) {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("Caminho de API inválido.");
  return `${origin}${path}`;
}
export async function apiFetch(path: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(75000);
  try {
    return await fetch(apiUrl(path), {
      ...options,
      credentials: "omit",
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(
      timeout.aborted
        ? "A API demorou a responder. Ela pode estar iniciando após um período de inatividade. Tente novamente."
        : "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
    );
  }
}
