import { notFound } from 'next/navigation';
import { getCatalogue, getCategory, getSubGroup, getCategoryNames, getSpecificationSummaries } from '@/lib/catalogue';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SpecificationList } from '@/components/catalogue/SpecificationList';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.values(catalogue.subGroups).map((subGroup) => ({
    categoryId: subGroup.categoryId,
    groupId: subGroup.id,
  }));
}

export default async function SubGroupPage({
  params,
}: {
  params: Promise<{ categoryId: string; groupId: string }>;
}) {
  const { categoryId, groupId } = await params;
  const catalogue = getCatalogue();
  const category = getCategory(categoryId, catalogue);
  const subGroup = getSubGroup(groupId, catalogue);
  if (!category || !subGroup || subGroup.categoryId !== category.id) notFound();

  const items = getSpecificationSummaries(catalogue, { categoryId: category.id, subGroupId: subGroup.id });

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: category.name || 'Untitled category', href: `/category/${category.id}` },
          { label: subGroup.name || 'Untitled group' },
        ]}
      />

      <div>
        <h1 className="text-display-xl text-fg">{subGroup.name || 'Untitled group'}</h1>
        {subGroup.description ? (
          <p className="mt-1 max-w-prose text-body-md text-fg-muted">{subGroup.description}</p>
        ) : null}
      </div>

      <SpecificationList
        items={items}
        emptyTitle="No specifications in this sub-group yet"
        emptyDescription="Specifications added to this sub-group will appear here."
        categoryNames={getCategoryNames(catalogue)}
      />
    </div>
  );
}
