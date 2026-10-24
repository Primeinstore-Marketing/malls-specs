import { notFound } from 'next/navigation';
import { getCatalogue, getSpecification } from '@/lib/catalogue';
import { SpecDetailView } from '@/components/spec/SpecDetailView';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.keys(catalogue.specifications).map((specId) => ({ specId }));
}

export default async function SpecPage({ params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params;
  if (!getSpecification(specId, getCatalogue())) notFound();
  return <SpecDetailView specId={specId} />;
}
