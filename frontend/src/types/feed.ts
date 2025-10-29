export type PricingView = 'B2C_ONLY'|'B2B_DEFAULT'|'COMPARATIVE'|'PUBLIC_REFERENCE';
export type SlotType = 'hero'|'collection'|'nav'|'chips'|'editorial';

export interface FeedItem {
  productId?: string;
  title?: string;
  subtitle?: string;
  image?: string;
  badges?: string[];
  priceB2C?: number; // opcional si en JSON fijas precio
  priceB2B?: number; // opcional
}

export interface FeedSlot {
  id: string;
  type: SlotType;
  title?: string;
  subtitle?: string;
  image?: string;
  layout?: 'grid'|'carousel';
  pricingView: PricingView;
  items?: FeedItem[];
}

export interface FeedResponse {
  version: string;
  updatedAt?: string;
  timezone?: string;
  slots: FeedSlot[];
}
