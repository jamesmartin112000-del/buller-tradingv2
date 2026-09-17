export type ValidityUnit = 'minutes' | 'hours' | 'days' | 'months';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MONTH_DAYS = 30;

export function durationToMilliseconds(amount: number, unit: ValidityUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === 'minutes') return amount * MINUTE_MS;
  if (unit === 'hours') return amount * HOUR_MS;
  if (unit === 'days') return amount * DAY_MS;
  return amount * MONTH_DAYS * DAY_MS;
}

export function durationToHours(amount: number, unit: ValidityUnit): number {
  return durationToMilliseconds(amount, unit) / HOUR_MS;
}

export function formatValidityHours(hours: number): string {
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes % (MONTH_DAYS * 24 * 60) === 0) {
    const months = minutes / (MONTH_DAYS * 24 * 60);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (minutes % 60 === 0) {
    const wholeHours = minutes / 60;
    return `${wholeHours} hour${wholeHours === 1 ? '' : 's'}`;
  }
  return `${minutes} minutes`;
}

export const MIN_VALIDITY_HOURS = 1 / 60;
export const MAX_VALIDITY_HOURS = 87_600;