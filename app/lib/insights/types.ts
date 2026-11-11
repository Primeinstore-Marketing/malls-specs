/** Shapes of the audience and package data taken from the proposal deck. */

export interface AgeBand {
  /** As printed on the slide, e.g. "25-34" or "65+". */
  readonly band: string;
  readonly pct: number;
}

export interface ShopperProfile {
  readonly monthlyFootcount: number | null;
  /** Average monthly household income in the primary catchment, rand. */
  readonly householdIncome: number | null;
  readonly ageBands: readonly AgeBand[];
  readonly female: number | null;
  readonly male: number | null;
  readonly married: number | null;
  readonly working: number | null;
  /** Higher-affinity LSM groups, e.g. "A" or "C&A". */
  readonly lsm: string | null;
  /** Higher-affinity shopper groups, as worded on the slide. */
  readonly affinity: string | null;
  readonly race: readonly { readonly group: string; readonly pct: number }[];
  readonly education: readonly { readonly level: string; readonly pct: number }[];
}

/** Share of mall visitors (past 3 months) who notice each kind of advertising. */
export interface MediaConsumption {
  readonly noticeMallAds?: number;
  readonly noticeIndoorAds?: number;
  readonly seenLargeScreens?: number;
  readonly seenDigitalScreens?: number;
}

export interface MediaPackage {
  readonly code: string;
  readonly name: string;
  /** "Digi Nav", "Digital Impact", "Digi Icon TV". */
  readonly format: string;
  readonly units: number | null;
  /** Where the units stand, as listed on the slide. */
  readonly sites: string;
  /** Slide number in the deck, for checking against the source. */
  readonly slide: number;
  /** The screen spec an admin chose for this package (sets its size and template). Unset: matched automatically. */
  readonly specId?: string | null;
}

export interface DeckMall {
  readonly id: string;
  readonly name: string;
  /** The matching mall on this site (with screens and specs), if there is one. */
  readonly appMallId: string | null;
  readonly province: string;
  readonly address: string | null;
  readonly annualFootcount: number | null;
  /** Gross lettable area, m². */
  readonly gla: number | null;
  readonly profile: ShopperProfile | null;
  readonly media: MediaConsumption | null;
  readonly packages: readonly MediaPackage[];
}
