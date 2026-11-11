import type { SizeFiles } from '@/lib/portal/screens';
import { sheetHref } from '@/lib/portal/screens';

const link = 'inline-flex items-center gap-1.5 text-body-sm font-semibold text-accent hover:underline';

/**
 * Spec sheet and After Effects template for one artwork size. When the size
 * is used by several screens with their own files, each gets a line.
 */
export function SizeDownloads({ files, compact = false }: { files: readonly SizeFiles[]; compact?: boolean }) {
  if (!files.length) return null;
  const one = files.length === 1;
  return (
    <ul className="flex flex-col gap-2">
      {files.map((f) => (
        <li key={f.specId} className="flex flex-col gap-1">
          {one ? null : <span className="text-[12px] text-fg-muted">{f.label}</span>}
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {f.sheet ? (
              <a href={sheetHref(f.sheet)} download={f.sheet.filename} className={link}>
                {compact ? 'PDF' : 'Spec sheet (PDF)'}
              </a>
            ) : null}
            {f.template ? (
              <a href={sheetHref(f.template)} download={f.template.filename} className={link}>
                <span className="rounded bg-[#00005b] px-1 text-[10px] font-bold leading-4 text-[#9999ff]">Ae</span>
                {compact ? 'Template' : 'After Effects template'}
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
