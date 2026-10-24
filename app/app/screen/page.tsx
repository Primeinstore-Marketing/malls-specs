'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SpecDetailView } from '@/components/spec/SpecDetailView';

/**
 * Full page for a screen an admin added after the site was built — those
 * have no pre-built `/spec/:id` page, so this one reads `?id=` in the browser.
 */
function ScreenPageContent() {
  const id = useSearchParams().get('id') ?? '';
  return <SpecDetailView specId={id} />;
}

export default function ScreenPage() {
  return (
    <Suspense>
      <ScreenPageContent />
    </Suspense>
  );
}
