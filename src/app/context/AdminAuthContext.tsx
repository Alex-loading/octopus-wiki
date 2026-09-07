import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getSupabaseClient, getUserRoleState, signOutAdmin } from "../content/repository";
import { READER_ROLE, watchAdminRole, type AdminRoleState } from "../auth/adminSession";

type AdminAuthState = AdminRoleState & { signingOut: boolean; signOut: () => Promise<void> };
export const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AdminRoleState>({ ...READER_ROLE, checking: true });
  const [signingOut, setSigningOut] = useState(false);
  const pendingLogout = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) { setRole({ ...READER_ROLE, checking: false }); return; }
    return watchAdminRole(client.auth, getUserRoleState, setRole);
  }, []);

  const signOut = useCallback((): Promise<void> => {
    if (pendingLogout.current) return pendingLogout.current;
    setSigningOut(true);
    pendingLogout.current = signOutAdmin().finally(() => {
      setSigningOut(false);
      pendingLogout.current = null;
    });
    return pendingLogout.current;
  }, []);

  return <AdminAuthContext.Provider value={{
    ...role,
    isAdmin: role.authenticated && role.isAdmin && !role.checking && !signingOut,
    checking: role.checking || signingOut,
    signingOut,
    signOut,
  }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
}
