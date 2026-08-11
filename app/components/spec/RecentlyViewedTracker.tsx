'use client';

import { useEffect } from 'react';
import type { SpecificationId } from '@data-model';
import { useCollections } from '@/components/collections/CollectionsContext';

/** Records a visit to `specId` on mount. Renders nothing. */
export function RecentlyViewedTracker({ specId }: { specId: SpecificationId }) {
  const { recordVisit, loaded } = useCollections();

  useEffect(() => {
    if (loaded) recordVisit(specId);
    // Only record once loaded, and only when the viewed spec changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specId, loaded]);

  return null;
}
