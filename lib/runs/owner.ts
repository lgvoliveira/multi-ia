// Identidade anônima do dono de uma execução, só no navegador. Antes do login (fase futura), é isto
// que diz "esta execução é minha": um id aleatório guardado no navegador, mandado ao servidor para
// poder cancelar a própria execução. O servidor guarda só o hash dele, nunca o valor em si.

const STORAGE_KEY = "multi-ia:owner-token";

/** Lê o token do dono deste navegador; cria um na primeira vez. Sem armazenamento, devolve um de sessão. */
export function getOwnerToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const token = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    // Navegador sem armazenamento (ex.: aba privada): um token só para esta carga da página.
    return crypto.randomUUID();
  }
}
