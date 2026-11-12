import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCatalogue, getSpecification } from '@/lib/catalogue';
import { getMallForSpec, getScreenSize } from '@/lib/malls';
import { SpecDetailView } from '@/components/spec/SpecDetailView';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.keys(catalogue.specifications).map((specId) => ({ specId }));
}

/** "Food Court, Cresta — 1920 × 1080": many malls have a Food Court, so the tab says which. */
export async function generateMetadata({ params }: { params: Promise<{ specId: string }> }): Promise<Metadata> {
  const { specId } = await params;
  const catalogue = getCatalogue();
  const spec = getSpecification(specId, catalogue);
  if (!spec) return {};
  const mall = getMallForSpec(specId, catalogue);
  const size = getScreenSize(spec);
  return {
    title: `${spec.title}${mall ? `, ${mall.name}` : ''}${size ? ` — ${size.width} × ${size.height}` : ''}`,
    description: spec.description || `Screen specification${mall ? ` at ${mall.name}` : ''}: size, safe area, spec sheet and template.`,
  };
}

export default async function SpecPage({ params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params;
  if (!getSpecification(specId, getCatalogue())) notFound();
  return <SpecDetailView specId={specId} />;
}
