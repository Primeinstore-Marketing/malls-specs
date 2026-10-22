import { Suspense } from 'react';
import { MallExplorer } from '@/components/map/MallExplorer';

export default function HomePage() {
  return (
    <Suspense>
      <MallExplorer />
    </Suspense>
  );
}
