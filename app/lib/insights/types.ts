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

/* ---------- Deck photos and their rights (loaded from the API) ---------- */

export type PhotoRightsStatus = 'needs-clearance' | 'cleared' | 'replace';

/** Who owns a photo taken from a proposal deck, and whether we may use it. */
export interface PhotoRights {
  readonly src: string;
  readonly mall: string;
  /** A mall's hero photo, a package's photo, or a photo of one screen. */
  readonly kind: 'mall' | 'package' | 'screen';
  readonly code: string | null;
  /** Where the deck got it from, as far as we can tell. */
  readonly source: string;
  readonly note: string;
  readonly action: string;
  readonly status: PhotoRightsStatus;
}

/** A photo from a proposal deck. `src` is "/malls/…"; the file is in the API's file store under that path. */
export interface DeckImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly slide: number;
}

export type DeckImages = Readonly<Record<string, { readonly hero: DeckImage | null; readonly packages: Readonly<Record<string, readonly DeckImage[]>> }>>;

/** A photo of one screen from the malls proposal deck. `exact` is false when matched by site location. */
export interface ScreenPhoto extends DeckImage {
  readonly package: string;
  readonly code: string;
  readonly exact: boolean;
}
