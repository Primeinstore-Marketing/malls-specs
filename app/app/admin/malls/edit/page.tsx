import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MallEditor } from '@/components/admin/MallEditor';

export const metadata: Metadata = { title: 'Edit mall' };

export default function Page() {
  return (
    <Suspense>
      <MallEditor />
    </Suspense>
  );
}
