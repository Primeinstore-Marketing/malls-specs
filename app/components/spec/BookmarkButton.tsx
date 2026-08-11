'use client';

import type { SpecificationId } from '@data-model';
import { useCollections } from '@/components/collections/CollectionsContext';

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function BookmarkButton({ specId }: { specId: SpecificationId }) {
  const { isBookmarked, toggleBookmark, loaded } = useCollections();
  const bookmarked = isBookmarked(specId);

  return (
    <button
      type="button"
      disabled={!loaded}
      onClick={() => toggleBookmark(specId)}
      aria-pressed={bookmarked}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-body-sm font-medium transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-50 ${
        bookmarked
          ? 'border-accent-border bg-accent-subtle text-accent-fg'
          : 'border-transparent bg-transparent text-fg-muted hover:bg-bg-subtle hover:text-fg'
      }`}
    >
      <StarIcon filled={bookmarked} />
      {bookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  );
}
