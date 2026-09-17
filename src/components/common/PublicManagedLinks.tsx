import { useMemo } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import { useContent } from '../../lib/db/hooks';

export interface PublicManagedLink {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: 'social' | 'referral' | 'event' | 'promotion' | 'resource';
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
}

export const DEFAULT_PUBLIC_LINKS: PublicManagedLink[] = [];

export function parsePublicLinks(value: string): PublicManagedLink[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PublicManagedLink =>
      Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.url === 'string')
    );
  } catch {
    return [];
  }
}

export function PublicManagedLinks() {
  const raw = useContent('public.links', '[]');
  const links = useMemo(() => {
    const now = Date.now();
    return parsePublicLinks(raw).filter((link) => {
      if (!link.enabled) return false;
      const starts = link.startsAt ? new Date(link.startsAt).getTime() : null;
      const ends = link.endsAt ? new Date(link.endsAt).getTime() : null;
      return (!starts || starts <= now) && (!ends || ends >= now);
    });
  }, [raw]);

  if (!links.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start" aria-label="Website links and social accounts">
      {links.map((link) =>
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={link.description || link.title}
        className="inline-flex min-h-9 items-center gap-1.5 rounded border border-line bg-bg-700 px-2.5 text-[10px] font-semibold text-ink-muted transition-colors hover:border-brand/45 hover:text-brand">
        
          {link.title}
          <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>);

}