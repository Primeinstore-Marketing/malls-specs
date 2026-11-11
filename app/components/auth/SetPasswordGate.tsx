'use client';

import { useAdminSession } from './AdminSession';
import { PasswordForm } from './PasswordForm';

/** The temporary password just used to sign in, so the person needn't type it again. */
let temporary = '';
export function rememberTemporaryPassword(password: string) {
  temporary = password;
}

/**
 * Someone signed in with a temporary password (a new account or a reset)
 * must choose their own before they can do anything else. The API refuses
 * everything but this until they have.
 */
export function SetPasswordGate() {
  const { mustChangePassword, account, signOut } = useAdminSession();
  if (!mustChangePassword) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] px-4 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="set-password-title" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-bg p-6 shadow-4">
        <div className="flex flex-col gap-1">
          <h2 id="set-password-title" className="text-display-sm text-fg">Choose your password</h2>
          <p className="text-body-sm text-fg-muted">
            Welcome{account?.name ? `, ${account.name.split(' ')[0]}` : ''}. You signed in with a temporary password; choose one only you know.
          </p>
        </div>
        <PasswordForm
          currentLabel="Temporary password"
          knownCurrent={temporary}
          submitLabel="Save and continue"
          onDone={() => {
            temporary = '';
          }}
        />
        <button type="button" onClick={() => void signOut()} className="self-start text-body-sm font-semibold text-fg-muted hover:text-fg">
          Sign out
        </button>
      </div>
    </div>
  );
}
