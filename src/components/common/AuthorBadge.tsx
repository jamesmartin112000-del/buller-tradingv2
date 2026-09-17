import React from 'react';
import { ShieldCheckIcon } from 'lucide-react';
export function AuthorBadge() {
  return (
    <div className="inline-flex items-center gap-2 bg-bg-700 border border-line rounded-md px-3 py-1.5">
      <ShieldCheckIcon className="w-3.5 h-3.5 text-brand" />
      <span className="text-2xs uppercase tracking-[0.18em] text-ink-muted font-semibold">
        Author <span className="text-ink ml-1">(R.D.H;~$)</span>
      </span>
    </div>);

}