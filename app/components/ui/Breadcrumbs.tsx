import Link from 'next/link';

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-fg-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="transition-colors duration-fast ease-standard hover:text-fg">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'text-fg' : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-fg-subtle">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
