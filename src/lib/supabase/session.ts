import { getSupabase } from "./client";

let pending: Promise<string> | null = null;

/**
 * Garantiza que exista una sesión anónima de Supabase y devuelve el id del
 * usuario. Se comparte la misma promesa para no crear dos usuarios si el
 * componente se monta dos veces (React Strict Mode).
 */
export function ensureSession(): Promise<string> {
  if (!pending) {
    pending = (async () => {
      const supabase = getSupabase();
      const { data: current } = await supabase.auth.getSession();
      if (current.session) return current.session.user.id;

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear la sesión anónima.");
      }
      return data.user.id;
    })().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
