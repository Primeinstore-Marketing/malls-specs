import { redirect } from 'next/navigation';

/** Not built yet; the tab is hidden. Old links land on the malls list. */
export default function Page() {
  redirect('/admin/malls');
}
