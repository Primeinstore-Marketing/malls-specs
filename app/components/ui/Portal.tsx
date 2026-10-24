'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children at the end of <body>. Dialogs need this when they're
 * opened from inside an element with a transform, filter or backdrop-filter
 * (the top bar has one): those turn `position: fixed` into "fixed to this
 * element", which would trap a full-screen dialog inside the bar.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
