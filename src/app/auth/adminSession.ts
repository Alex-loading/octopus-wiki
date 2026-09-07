import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRoleState = { authenticated: boolean; isAdmin: boolean; userId: string | null };
export type AdminRoleState = UserRoleState & { checking: boolean };
export const READER_ROLE: UserRoleState = { authenticated: false, isAdmin: false, userId: null };

export function createAdminLoginGesture() {
  let clicks: number[] = [];
  return (now: number): boolean => {
    clicks = clicks.filter(time => now >= time && now - time <= 2000);
    clicks.push(now);
    if (clicks.length < 5) return false;
    clicks = [];
    return true;
  };
}

export function safeAdminReturnPath(value?: string | null): string {
  const fallback = "/admin/articles";
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://wiki.invalid");
    const knownPage = ["/", "/blog", "/lab", "/about", "/admin/articles", "/admin/bookmarks", "/collections", "/collect", "/collect/setup"].includes(url.pathname);
    if (url.origin !== "https://wiki.invalid" || (!knownPage && !/^\/(post|collections)\/[^/]+$/.test(url.pathname))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Persist only for the current tab; blocked storage degrades to in-memory auth. */
export function createTabSessionStorage(
  getStorage: () => SessionStorage | undefined = () => typeof window === "undefined" ? undefined : window.sessionStorage,
): SessionStorage {
  const memory = new Map<string, string>();
  let disabled = false;
  return {
    getItem(key) {
      try {
        const storage = disabled ? undefined : getStorage();
        if (storage) {
          const value = storage.getItem(key);
          if (value === null) memory.delete(key); else memory.set(key, value);
          return value;
        }
      } catch { disabled = true; }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try { if (!disabled) getStorage()?.setItem(key, value); } catch { disabled = true; }
    },
    removeItem(key) {
      memory.delete(key);
      try { if (!disabled) getStorage()?.removeItem(key); } catch { disabled = true; }
    },
  };
}

/** One subscription for the site. Do not trust roles in an unverified session. */
export function watchAdminRole(
  auth: Pick<SupabaseClient["auth"], "onAuthStateChange">,
  readRole: () => Promise<UserRoleState>,
  onChange: (state: AdminRoleState) => void,
): () => void {
  let disposed = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    const requestRevision = ++revision;
    onChange({ ...READER_ROLE, checking: true });
    try {
      const role = await readRole();
      if (!disposed && revision === requestRevision) onChange({ ...role, isAdmin: role.authenticated && role.isAdmin, checking: false });
    } catch {
      if (!disposed && revision === requestRevision) onChange({ ...READER_ROLE, checking: false });
    }
  };
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    if (disposed) return;
    ++revision;
    clearTimeout(timer);
    onChange({ ...READER_ROLE, checking: Boolean(session) });
    // Defer Auth calls until the callback releases Supabase's session lock.
    if (session) timer = setTimeout(() => { void refresh(); }, 0);
  });
  void refresh();
  return () => {
    disposed = true;
    ++revision;
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}
