import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalogue, getCategory, getCategoryTree, getCategoryNames, getSpecificationSummaries } from '@/lib/catalogue';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SpecificationList } from '@/components/catalogue/SpecificationList';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.keys(catalogue.categories).map((categoryId) => ({ categoryId }));
}

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const catalogue = getCatalogue();
  const category = getCategory(categoryId, catalogue);
  if (!category) notFound();

  const node = getCategoryTree(catalogue).find((entry) => entry.category.id === category.id);
  const subGroups = node?.subGroups ?? [];
  const directItems = getSpecificationSummaries(catalogue, { categoryId: category.id }).filter(
    (spec) => !spec.subGroupId,
  );

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: category.name || 'Untitled category' }]} />

      <div>
        <h1 className="text-display-xl text-fg">{category.name || 'Untitled category'}</h1>
        {category.description ? (
          <p className="mt-1 max-w-prose text-body-md text-fg-muted">{category.description}</p>
        ) : null}
      </div>

      {subGroups.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionLabel>Sub-groups</SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subGroups.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/category/${category.id}/${sub.id}`}
                  className="block rounded-lg border border-border p-4 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-bg-subtle"
                >
                  <span className="block text-body-md font-medium text-fg">{sub.name || 'Untitled group'}</span>
                  {sub.description ? (
                    <span className="mt-1 block text-body-sm text-fg-subtle">{sub.description}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SpecificationList
        items={directItems}
        emptyTitle="No specifications in this category yet"
        emptyDescription="Specifications added directly to this category, outside a sub-group, will appear here."
        categoryNames={getCategoryNames(catalogue)}
      />
    </div>
  );
}
