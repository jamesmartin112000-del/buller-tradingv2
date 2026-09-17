import { useEffect, useState } from 'react';

export function useLocalStorage<T>(
key: string,
initial: T)
: [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw =
      typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) return JSON.parse(raw) as T;
    } catch {}
    return initial;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal as any];
}