import type { LiveContentRecord } from './api';
import { applyDeckData, applyMallContent } from './insights';
import type { MallContent, PhotoRightsStatus } from './insights';
import { applyClients } from './portal/seed';
import { applySites } from './sites';
import type { Client } from './portal/types';

/**
 * Admin-edited site content from the API, applied over the built-in data:
 *   site:<id>     a mall: name, place, map position, published or deleted (lib/sites.ts)
 *   mall:<id>     a mall's audience, packages and photos (MallContent)
 *   client:<id>   a client and their contact (Client)
 *   photo-rights  { statuses: { "<photo src>": "cleared" | ... } }
 *   deck-malls, deck-images, photo-register, screen-photos
 *                 the proposal deck's data, which is not kept in the code
 */
let records: readonly LiveContentRecord[] = [];

export function applyContent(list: readonly LiveContentRecord[] = []) {
  records = list;
  const get = (key: string) => list.find((r) => r.key === key)?.data as never;
  applySites(list);
  applyDeckData({ malls: get('deck-malls'), images: get('deck-images'), register: get('photo-register'), screens: get('screen-photos') });
  const malls = list.filter((r) => r.key.startsWith('mall:')).map((r) => r.data as MallContent);
  const rights = (list.find((r) => r.key === 'photo-rights')?.data as { statuses?: Record<string, PhotoRightsStatus> } | undefined)?.statuses ?? {};
  applyMallContent(malls, rights);
  applyClients(list.filter((r) => r.key.startsWith('client:')).map((r) => r.data as Client));
}

/** When (and whether) an admin last saved this key. */
export function contentUpdatedAt(key: string): string | null {
  return records.find((r) => r.key === key)?.updatedAt ?? null;
}

export function contentPhotoRights(): Record<string, PhotoRightsStatus> {
  return { ...((records.find((r) => r.key === 'photo-rights')?.data as { statuses?: Record<string, PhotoRightsStatus> } | undefined)?.statuses ?? {}) };
}
