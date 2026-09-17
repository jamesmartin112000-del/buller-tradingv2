export type EconomicImpact = 'high' | 'medium' | 'low';

export interface EconomicEvent {
  id: string;
  timestamp: number;
  country: string;
  currency: string;
  flag: string;
  event: string;
  category: string;
  impact: EconomicImpact;
  previous: string;
  forecast: string;
  actual?: string;
  affected: string[];
  source: string;
  sourceUrl: string;
}

export interface CalendarFeedResponse {
  events: EconomicEvent[];
  fetchedAt: number;
  source: string;
}