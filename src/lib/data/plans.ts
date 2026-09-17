/**
 * Canonical membership plans — the SINGLE source of truth for pricing.
 *
 * Product rule (per spec): EVERY plan unlocks the exact same engine — all
 * indicators, God Signal, the institutional SMC / ICT / AMD suite and every
 * premium feature. Plans differ ONLY by validity (and therefore price):
 *
 *     15 Days · 1 Month · 6 Months · 1 Year
 *
 * Both the user-facing surfaces (Landing pricing, Signup, Gate) and the admin
 * surfaces (Admin → Plans, seeded `plans` collection) read from here so the
 * details are identical everywhere.
 */
import type { Plan } from '../db/store';

export type PlanId = 'weekly' | 'monthly' | 'biannual' | 'annual';

/**
 * The full premium feature set — IDENTICAL for every plan. This is the only
 * feature list any plan card should ever show.
 */
export const SHARED_PLAN_FEATURES: string[] = [
'All premium indicators',
'BULLER TRADING Signal access',
'Institutional SMC / ICT / AMD suite',
'Trap detector & order-flow analytics',
'All premium features included',
'Single secure device',
'Priority WhatsApp support'];


export interface MembershipPlan {
  id: PlanId;
  /** Human label shown on cards (the validity itself is the differentiator). */
  name: string;
  /** Display price string, e.g. "$79". */
  price: string;
  /** Numeric amount (USDT) sent to the payment service. */
  amount: number;
  /** Friendly duration label, e.g. "1 month". */
  duration: string;
  /** Validity granted on approval, in days. */
  days: number;
  /** Store-shape duration fields (mirrored into the `plans` collection). */
  durationUnit: Plan['durationUnit'];
  durationCount: number;
  /** Device cap — single device for every plan, per engine policy. */
  devices: number;
  /** Short, professional marketing line for the card. */
  description: string;
  /** Highlighted as the recommended / most-popular plan. */
  popular?: boolean;
  /** Highlighted as the best long-term value. */
  bestValue?: boolean;
}

export const PLANS: MembershipPlan[] = [
{
  id: 'weekly',
  name: '15 Days',
  price: '$49',
  amount: 49,
  duration: '15 days',
  days: 15,
  durationUnit: 'days',
  durationCount: 15,
  devices: 1,
  description: 'Complete BULLER TRADING access for fifteen days.'
},
{
  id: 'monthly',
  name: '1 Month',
  price: '$99',
  amount: 99,
  duration: '1 month',
  days: 30,
  durationUnit: 'months',
  durationCount: 1,
  devices: 1,
  description: 'Our most popular plan — complete BULLER TRADING access for 30 days.',
  popular: true
},
{
  id: 'biannual',
  name: '6 Months',
  price: '$599',
  amount: 599,
  duration: '6 months',
  days: 180,
  durationUnit: 'months',
  durationCount: 6,
  devices: 1,
  description: 'Half a year of uninterrupted complete platform access.'
},
{
  id: 'annual',
  name: '1 Year',
  price: '$1199',
  amount: 1199,
  duration: '1 year',
  days: 365,
  durationUnit: 'years',
  durationCount: 1,
  devices: 1,
  description: 'Best value — one year of complete BULLER TRADING access.',
  bestValue: true
}];


/** Legacy plan ids → validity days, so old payment records still resolve. */
const LEGACY_DAYS: Record<string, number> = {
  starter: 15,
  pro: 30,
  elite: 365
};

export function planById(id?: string | null): MembershipPlan | undefined {
  if (!id) return undefined;
  return PLANS.find((p) => p.id === id);
}

/** Resolve validity days from a plan id or display name (canonical + legacy). */
export function planDaysFor(idOrName?: string | null): number {
  if (!idOrName) return 30;
  const key = idOrName.trim().toLowerCase();
  const canonical = PLANS.find(
    (p) => p.id === key || p.name.toLowerCase() === key
  );
  if (canonical) return canonical.days;
  return LEGACY_DAYS[key] ?? 30;
}

/**
 * Map the canonical plans into `plans`-collection records for seeding / admin
 * display. Every record carries the SAME shared feature list.
 */
export function toPlanRecords(now: number): Plan[] {
  return PLANS.map((p) => ({
    id: `plan_${p.id}`,
    name: `${p.name} Access`,
    durationUnit: p.durationUnit,
    durationCount: p.durationCount,
    price: p.price,
    maxDevices: p.devices,
    description: p.description,
    features: [...SHARED_PLAN_FEATURES],
    featured: !!p.popular,
    active: true,
    createdAt: now,
    updatedAt: now
  }));
}