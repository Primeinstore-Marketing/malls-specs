'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, apiConfigured, getStoredToken, storeToken } from '@/lib/api';
import type { AdminProfile } from '@/lib/api';
import { refreshLiveData } from '@/lib/liveData';

/**
 * Who's signed in. Only admins have accounts — there's no public sign-up —
 * so "signed in" means "may edit". The server checks the session on every
 * change regardless; this context just decides what the UI offers.
 */

type SessionStatus = 'checking' | 'signed-out' | 'signed-in';

interface AdminSessionValue {
  readonly status: SessionStatus;
  readonly admin: AdminProfile | null;
  readonly isAdmin: boolean;
  /** False when the site was built without an API, so sign-in can't work. */
  readonly available: boolean;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Call when the API rejects a session (expired / revoked). */
  readonly sessionExpired: () => void;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  useEffect(() => {
    // Everyone gets the latest edits, signed in or not.
    void refreshLiveData();

    if (!apiConfigured || !getStoredToken()) {
      setStatus('signed-out');
      return;
    }
    api
      .me()
      .then(({ admin: profile }) => {
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
    setAdmin(result.admin);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Signing out locally still matters if the server can't be reached.
    }
    storeToken(null);
    setAdmin(null);
    setStatus('signed-out');
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
      isAdmin: status === 'signed-in',
      available: apiConfigured,
      signIn,
      signOut,
      sessionExpired,
    }),
    [status, admin, signIn, signOut, sessionExpired],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
