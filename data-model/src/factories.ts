/**
 * Empty-value constructors.
 *
 * Every factory returns a record with no content — empty strings, empty
 * arrays, null values, zero counts. Nothing here invents a value.
 */
import { newId, asSpecificationId, asCategoryId, asSubGroupId, asTagId, asAssetId,
         asRevisionId, asUserId, asMetadataFieldId, asBlockId } from './ids';
import type { CategoryId, SpecificationId } from './ids';
import { emptySpecification } from './specification';
import { emptyCategory, emptySubGroup, emptyTag } from './taxonomy';
import { emptyAsset } from './assets';
import type { AssetRole } from './assets';
import { emptyRevision } from './revision';
import { emptyUser } from './access';
import { emptyBlock, emptyMetadataField } from './content';
import type { SpecBlock, MetadataField } from './content';
import type { Category } from './taxonomy';

export const createSpecification = () => emptySpecification(asSpecificationId(newId()));
export const createCategory = (order = 0) => emptyCategory(asCategoryId(newId()), order);
export const createSubGroup = (categoryId: CategoryId, order = 0) =>
  emptySubGroup(asSubGroupId(newId()), categoryId, order);
export const createTag = () => emptyTag(asTagId(newId()));
export const createAsset = (role: AssetRole, order = 0) =>
  emptyAsset(asAssetId(newId()), role, order);
export const createRevision = (specificationId: SpecificationId) =>
  emptyRevision(asRevisionId(newId()), specificationId);
export const createUser = () => emptyUser(asUserId(newId()));
export const createBlock = (label: string, order = 0): SpecBlock =>
  emptyBlock(asBlockId(newId()), label, order);
export const createMetadataField = (key: string, label: string, order = 0): MetadataField =>
  emptyMetadataField(asMetadataFieldId(newId()), key, label, order);

/**
 * A new specification in a category inherits that category's block labels and
 * metadata template — with empty values. This is how a domain convention
 * propagates without a schema change.
 */
export function createSpecificationInCategory(category: Category) {
  const base = createSpecification();
  return {
    ...base,
    categoryId: category.id,
    blocks: category.blockTemplate.map((label, i) => createBlock(label, i)),
    metadata: category.metadataTemplate.fields.map((f, i) => ({
      ...f, value: null, order: i, inherited: true,
    })),
  };
}
