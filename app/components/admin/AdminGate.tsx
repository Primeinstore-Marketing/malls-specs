'use client';

import type { ReactNode } from 'react';
import { useAdminSession } from '@/components/auth/AdminSession';
import { useAuthDialog } from '@/components/auth/AuthDialogContext';
import { api } from '@/lib/api';
import { useLiveData } from '@/lib/liveData';
import type { UploadedPhoto } from '@/lib/insights';

/** Admin pages: shown to signed-in admins; everyone else gets the sign-in. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { status, isAdmin, available } = useAdminSession();
  const { setOpen } = useAuthDialog();
  useLiveData(); // re-render when saved content comes back from the API
  if (status === 'checking') return <div className="h-48 animate-pulse rounded-2xl bg-bg-subtle" />;
  if (isAdmin) return <>{children}</>;
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl bg-bg-subtle p-6">
      <h2 className="text-display-sm text-fg">Sign in as an admin</h2>
      <p className="max-w-prose text-body-md text-fg-muted">
        {available
          ? 'Admins can edit malls, screens, photos and clients. Changes go live on the site for everyone.'
          : 'This copy of the site has no API configured, so changes can’t be saved.'}
      </p>
      {available ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
          Admin sign in
        </button>
      ) : null}
    </div>
  );
}

/**
 * Uploads a photo that isn't a screen's own picture (a mall or package
 * photo). The API stores files against an id; these use "mallphoto-…" and
 * "pkgphoto-…" so they never attach to a real screen.
 */
export async function uploadPhoto(ownerId: string, file: File): Promise<UploadedPhoto> {
  const { asset } = await api.uploadFile(ownerId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 90), 'media', file);
  return { storageKey: asset.storageKey, width: asset.image?.width ?? null, height: asset.image?.height ?? null };
}

export const field = 'h-11 w-full rounded-xl border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';
export const fieldLabel = 'text-label-md font-semibold uppercase text-fg-muted';
export const primaryBtn = 'inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50';
export const quietBtn = 'inline-flex h-11 items-center justify-center rounded-full px-4 text-body-sm font-semibold text-fg-muted hover:bg-bg-subtle hover:text-fg disabled:opacity-50';
