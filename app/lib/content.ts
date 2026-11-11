import type { LiveContentRecord } from './api';
import { applyMallContent } from './insights';
import type { MallContent, PhotoRightsStatus } from './insights';
import { applyClients } from './portal/seed';
import type { Client } from './portal/types';

/**
 * Admin-edited site content from the API, applied over the built-in data:
 *   mall:<id>     a mall's audience, packages and photos (MallContent)
 *   client:<id>   a client and their contact (Client)
 *   photo-rights  { statuses: { "<photo src>": "cleared" | ... } }
 */
let records: readonly LiveContentRecord[] = [];

export function applyContent(list: readonly LiveContentRecord[] = []) {
  records = list;
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
