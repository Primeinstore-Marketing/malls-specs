import { getCatalogue, getCatalogueStats } from '@/lib/catalogue';
import { Hero } from '@/components/landing/Hero';

export default function HomePage() {
  const catalogue = getCatalogue();
  const stats = getCatalogueStats(catalogue);

  return <Hero stats={stats} />;
}
