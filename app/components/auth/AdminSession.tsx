'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { withBasePath } from '@/lib/basePath';
import { api, ApiError, apiConfigured, getStoredToken, storeToken } from '@/lib/api';
import type { AdminProfile } from '@/lib/api';
import { refreshLiveData } from '@/lib/liveData';
import { setSessionUser } from '@/lib/portal/seed';
import type { PortalUser } from '@/lib/portal/types';

/**
 * Who's signed in. Primedia accounts only (no public sign-up): admins, who
 * also get Site admin, and sales. Both use email and password and both get
 * the workspace. The server checks the session and role on every change;
 * this context just decides what the UI offers.
 */

/** The workspace's view of an account. */
function asPortalUser(a: AdminProfile): PortalUser {
  return { id: `a-${a.id}`, name: a.name || a.email, email: a.email, role: 'sales', title: a.title || (a.role === 'admin' ? 'Primedia Malls' : 'Sales, Primedia Malls') };
}

type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface AdminSessionValue {
  readonly status: SessionStatus;
  /** The signed-in account (admin or sales). */
  readonly admin: AdminProfile | null;
  readonly account: AdminProfile | null;
  /** Signed in with the admin role (and a password of their own). */
  readonly isAdmin: boolean;
  /** Signed in at all, admin or sales. */
  readonly isSignedIn: boolean;
  /** On a temporary password: must choose their own before anything else. */
  readonly mustChangePassword: boolean;
  /** After a profile or password change. */
  readonly setAccount: (account: AdminProfile) => void;
  /** False when the site was built without an API, so sign-in can't work. */
  readonly available: boolean;
  readonly signIn: (email: string, password: string) => Promise<AdminProfile>;
  readonly signOut: () => Promise<void>;
  /** Call when the API rejects a session (expired / revoked). */
  readonly sessionExpired: () => void;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  // The workspace follows the account (only once the password is their own).
  useEffect(() => {
    if (status === 'checking') return;
    setSessionUser(admin && !admin.mustChangePassword ? asPortalUser(admin) : null);
  }, [status, admin]);

  useEffect(() => {
    // Everyone gets the latest edits, signed in or not.
    void refreshLiveData();

    if (!apiConfigured || !getStoredToken()) {
      setStatus('signed-out');
      return;
    }
    api
      .me()
      .then(({ account: profile }) => {
        setAdmin(profile);
        setStatus('signed-in');
      })
      .catch((error) => {
        // Only forget the token if the server actually rejected it.
        if (error instanceof ApiError && error.status === 401) storeToken(null);
        setStatus('signed-out');
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    storeToken(result.token);
    setAdmin(result.account);
    setStatus('signed-in');
    // Signed-in accounts also get what the public doesn't (client contacts).
    void refreshLiveData();
    return result.account;
  }, []);

  const setAccount = useCallback((account: AdminProfile) => {
    setAdmin(account);
    void refreshLiveData();
  }, []);

  // Signing out always lands on the home page (an expired session doesn't move you).
  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Signing out locally still matters if the server can't be reached.
    }
    storeToken(null);
    setAdmin(null);
    setStatus('signed-out');
    // A full load of the home page: a client-side push can be dropped as the admin menus unmount.
    window.location.assign(withBasePath('/'));
  }, []);

  const sessionExpired = useCallback(() => {
    storeToken(null);
    setAdmin(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({
      status,
      admin,
      account: admin,
      isAdmin: status === 'signed-in' && admin?.role === 'admin' && !admin.mustChangePassword,
      isSignedIn: status === 'signed-in' && Boolean(admin),
      mustChangePassword: status === 'signed-in' && Boolean(admin?.mustChangePassword),
      setAccount,
      available: apiConfigured,
      signIn,
      signOut,
      sessionExpired,
    }),
    [status, admin, signIn, signOut, sessionExpired, setAccount],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
