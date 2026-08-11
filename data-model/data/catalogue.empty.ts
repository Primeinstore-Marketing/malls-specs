/**
 * The shipping catalogue.
 *
 * Deliberately, verifiably empty. No categories, no specifications, no tags,
 * no assets, no revisions, no users. Content is added through the admin
 * interface or by replacing this file.
 */
import { emptyCatalogue } from '../src/catalogue';
import type { Catalogue } from '../src/catalogue';

export const catalogue: Catalogue = emptyCatalogue();

export default catalogue;
