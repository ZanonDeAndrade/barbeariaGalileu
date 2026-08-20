/**
 * Chave de acesso do painel do barbeiro.
 *
 * Antes a chave vinha de VITE_BARBER_API_KEY, ou seja, era compilada dentro do
 * bundle publico: qualquer pessoa que abrisse o site podia le-la no JavaScript
 * e usar a API do barbeiro. Agora a chave e digitada pelo barbeiro e fica
 * apenas neste navegador.
 *
 * Isto e conveniencia de sessao, nao a fronteira de seguranca — quem valida a
 * chave e o servidor (middleware requireBarber), em toda requisicao.
 */

const STORAGE_KEY = 'barberApiKey';
export const BARBER_AUTH_EVENT = 'barber-auth-changed';

function notifyChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(BARBER_AUTH_EVENT));
}

export function getBarberApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    return null;
  }
}

export function setBarberApiKey(key: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // Modo privado / storage bloqueado: a chave vale so para esta sessao.
  }
  notifyChange();
}

/**
 * O contexto de re-inscricao push (usado pelo service worker) guarda uma copia
 * da chave para poder reinscrever o barbeiro sozinho. Sair sem limpar esse
 * cache deixaria a chave no dispositivo.
 */
const PUSH_CONTEXT_CACHE = 'push-config';

export function clearBarberApiKey() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  if (typeof caches !== 'undefined') {
    void caches.delete(PUSH_CONTEXT_CACHE).catch(() => undefined);
  }

  notifyChange();
}

export function subscribeToBarberAuth(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(BARBER_AUTH_EVENT, listener);
  // Mantem abas do mesmo navegador em sincronia (logout em uma desloga a outra).
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(BARBER_AUTH_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
