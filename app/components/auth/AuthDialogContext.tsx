'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface AuthDialogContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <AuthDialogContext.Provider value={value}>{children}</AuthDialogContext.Provider>;
}

export function useAuthDialog(): AuthDialogContextValue {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error('useAuthDialog must be used within AuthDialogProvider');
  return ctx;
}
