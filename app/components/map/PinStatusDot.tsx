import { PIN_SOURCE_LABELS } from '@/lib/malls';
import type { ScreenPin } from '@/lib/malls';

/**
 * How sure we are of a screen's position, at a glance: solid = confirmed,
 * ring = approximate (at a store, or estimated), dashed = placeholder or
 * not on the map. Shared by the side panel and the main navigation.
 */
export function PinStatusDot({ pin, className = '' }: { pin: ScreenPin | undefined; className?: string }) {
  const source = pin?.source;
  const style =
    source === 'confirmed'
      ? 'bg-accent'
      : source === 'osm-draft' || source === 'estimated'
        ? 'border-[1.5px] border-accent'
        : 'border border-dashed border-current opacity-60';
  const label = source ? PIN_SOURCE_LABELS[source] : 'Not on the map';
  return (
    <span
      role="img"
      aria-label={`Position: ${label}`}
      title={`Position: ${label}`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${style} ${className}`}
    />
  );
}
