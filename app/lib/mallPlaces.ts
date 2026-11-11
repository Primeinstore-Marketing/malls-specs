/**
 * Where each mall is, in words: its public name, area, city and province.
 * Keyed by the mall ids in `malls.ts`. Used by the Media Explorer to group
 * malls by province and to search by city or suburb.
 *
 * Copied from the Primedia Out of Home website's sync script
 * (`scripts/sync-mall-specs.mts`, PLACES), so both sites describe each mall
 * the same way. A mall missing here still shows; it just has no province.
 */

export interface MallPlace {
  /** The centre's public name, e.g. "Cresta Shopping Centre". */
  readonly name: string;
  readonly area: string;
  readonly city: string;
  readonly province: string;
  /** Something still to confirm about this mall. */
  readonly note?: string;
}

const place = (name: string, area: string, city: string, province: string, note?: string): MallPlace =>
  note ? { name, area, city, province, note } : { name, area, city, province };

export const MALL_PLACES: Readonly<Record<string, MallPlace>> = {
  cresta: place('Cresta Shopping Centre', 'Randburg', 'Johannesburg', 'Gauteng'),
  menlyn: place('Menlyn Park', 'Menlyn', 'Pretoria', 'Gauteng'),
  'monte-casino': place('Montecasino', 'Fourways', 'Johannesburg', 'Gauteng'),
  pavilion: place('The Pavilion', 'Westville', 'Durban', 'KwaZulu-Natal'),
  southgate: place('Southgate', 'Johannesburg South', 'Johannesburg', 'Gauteng'),
  tygervalley: place('Tyger Valley', 'Bellville', 'Cape Town', 'Western Cape'),
  bayside: place('Bayside Mall', 'Table View', 'Cape Town', 'Western Cape'),
  boardwalk: place('Boardwalk', 'Summerstrand', 'Gqeberha', 'Eastern Cape'),
  brooklyn: place('Brooklyn Mall', 'Brooklyn', 'Pretoria', 'Gauteng'),
  fourways: place('Fourways Mall', 'Fourways', 'Johannesburg', 'Gauteng'),
  gardens: place('Gardens Centre', 'Gardens', 'Cape Town', 'Western Cape'),
  gateway: place('Gateway', 'Umhlanga', 'Durban', 'KwaZulu-Natal'),
  'golden-acre': place('Golden Acre', 'City Centre', 'Cape Town', 'Western Cape'),
  'loch-logan': place('Loch Logan Waterfront', 'Willows', 'Bloemfontein', 'Free State'),
  mimosa: place('Mimosa Mall', 'Brandwag', 'Bloemfontein', 'Free State'),
  'n1-city': place('N1 City', 'Goodwood', 'Cape Town', 'Western Cape'),
  'paarl-mall': place('Paarl Mall', 'Paarl', 'Paarl', 'Western Cape'),
  westgate: place('Westgate', 'Roodepoort', 'Johannesburg', 'Gauteng'),
  'canal-walk': place('Canal Walk', 'Century City', 'Cape Town', 'Western Cape'),
  'cape-gate': place('CapeGate', 'Brackenfell', 'Cape Town', 'Western Cape'),
  clearwater: place('Clearwater Mall', 'Strubens Valley', 'Johannesburg', 'Gauteng'),
  'table-bay': place('Table Bay Mall', 'Sunningdale', 'Cape Town', 'Western Cape'),
  'hype-park': place('Hyde Park Corner', 'Hyde Park', 'Johannesburg', 'Gauteng', 'Listed as “Hype Park”; taken to be Hyde Park Corner. To confirm.'),
  rosebank: place('Rosebank Mall', 'Rosebank', 'Johannesburg', 'Gauteng'),
  somerset: place('Somerset Mall', 'Somerset West', 'Cape Town', 'Western Cape'),
  'the-glen': place('The Glen', 'Oakdene', 'Johannesburg', 'Gauteng'),
  woodlands: place('Woodlands Boulevard', 'Pretorius Park', 'Pretoria', 'Gauteng'),
};

/** Provinces in the order the explorer lists them (most malls first). */
export const PROVINCE_ORDER: readonly string[] = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Free State', 'Eastern Cape'];

/** "Randburg, Johannesburg · Gauteng" */
export function placeLine(p: MallPlace): string {
  return `${p.area === p.city ? p.city : `${p.area}, ${p.city}`} · ${p.province}`;
}
