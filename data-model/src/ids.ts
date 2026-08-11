/**
 * Branded identifiers.
 *
 * A CategoryId and a SpecificationId are both strings at runtime, but assigning
 * one where the other is expected is a compile error. This is the cheapest
 * defence against the class of bug that reference-by-string invites, and it
 * costs nothing at runtime.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type SpecificationId = Brand<string, 'SpecificationId'>;
export type CategoryId      = Brand<string, 'CategoryId'>;
export type SubGroupId      = Brand<string, 'SubGroupId'>;
export type TagId           = Brand<string, 'TagId'>;
export type RevisionId      = Brand<string, 'RevisionId'>;
export type AssetId         = Brand<string, 'AssetId'>;
export type MetadataFieldId = Brand<string, 'MetadataFieldId'>;
export type UserId          = Brand<string, 'UserId'>;
export type BlockId         = Brand<string, 'BlockId'>;

/** Opaque constructors. Ids are minted in one place so the strategy can change once. */
export const asSpecificationId = (v: string) => v as SpecificationId;
export const asCategoryId      = (v: string) => v as CategoryId;
export const asSubGroupId      = (v: string) => v as SubGroupId;
export const asTagId           = (v: string) => v as TagId;
export const asRevisionId      = (v: string) => v as RevisionId;
export const asAssetId         = (v: string) => v as AssetId;
export const asMetadataFieldId = (v: string) => v as MetadataFieldId;
export const asUserId          = (v: string) => v as UserId;
export const asBlockId         = (v: string) => v as BlockId;

/**
 * Id generation. The reference system uses Date.now(), which collides under
 * concurrent authoring and leaks creation time into the URL. This is a
 * sortable, collision-resistant alternative with the same ergonomics.
 */
export function newId(): string {
  const t = Date.now().toString(36).padStart(9, '0');
  const r = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 6);
  return `${t}${r}${r2}`;
}
