export interface AnchorItem {
  readonly id: string;
  readonly label: string;
}

export function AnchorRail({ items }: { items: readonly AnchorItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Sections" className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2 no-scrollbar sm:px-6">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="shrink-0 rounded-full border border-border-strong px-3 py-1 text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:border-border-control hover:text-fg"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
