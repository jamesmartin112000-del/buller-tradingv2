import { useEffect, useMemo, useState } from 'react';
import { fsSubscribe } from '../lib/backend/docStore';
import { useCollection } from '../lib/db/hooks';
import { cacheLocalRecord, type Plan } from '../lib/db/store';
import {
  PLANS,
  SHARED_PLAN_FEATURES,
  type MembershipPlan } from
'../lib/data/plans';

export interface AvailableMembershipPlan extends Omit<MembershipPlan, 'id'> {
  id: string;
  features: string[];
}

export function useMembershipPlans(): AvailableMembershipPlan[] {
  const cachedRecords = useCollection('plans');
  const [cloudRecords, setCloudRecords] = useState<Plan[] | null>(null);

  useEffect(() => {
    return fsSubscribe<Plan>(
      'plans',
      (rows) => {
        setCloudRecords(rows);
        rows.forEach((record) => cacheLocalRecord('plans', record));
      },
      [],
      (error) => console.warn('[plans] Live pricing unavailable', error)
    );
  }, []);

  return useMemo(() => {
    const records = cloudRecords ?? cachedRecords;
    const active = records.filter((record) => record.active);
    if (!records.length) {
      return PLANS.map((plan) => ({
        ...plan,
        features: [...SHARED_PLAN_FEATURES]
      }));
    }

    return active.map((record) => {
      const normalizedId = record.id.replace(/^plan_/, '');
      const fallback = PLANS.find((plan) => plan.id === normalizedId);
      const amount = parseAmount(record.price, fallback?.amount ?? 0);
      return {
        id: normalizedId,
        name: record.name.replace(/\s+Access$/i, ''),
        price: record.price,
        amount,
        duration: `${record.durationCount} ${record.durationUnit}`,
        days: toDays(record.durationCount, record.durationUnit),
        durationUnit: record.durationUnit,
        durationCount: record.durationCount,
        devices: record.maxDevices,
        description: record.description,
        popular: record.featured,
        bestValue: fallback?.bestValue,
        features: record.features
      };
    });
  }, [cachedRecords, cloudRecords]);
}

function parseAmount(price: string, fallback: number): number {
  const normalized = price.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : fallback;
}

function toDays(
count: number,
unit: 'days' | 'months' | 'years')
: number {
  if (unit === 'years') return count * 365;
  if (unit === 'months') return count * 30;
  return count;
}