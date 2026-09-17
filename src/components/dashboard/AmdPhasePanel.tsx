import React, { Fragment } from 'react';
import type { AMDState } from '../../lib/engine/types';
const PHASES = ['ACCUMULATION', 'MANIPULATION', 'DISTRIBUTION'] as const;
type PhaseLabel = (typeof PHASES)[number];
const SHORT: Record<PhaseLabel, string> = {
  ACCUMULATION: 'Accum.',
  MANIPULATION: 'Manip.',
  DISTRIBUTION: 'Distrib.'
};
export function AmdPhasePanel({ amd }: {amd: AMDState;}) {
  const activeIndex = PHASES.indexOf(amd.phase as PhaseLabel);
  const isNeutral = activeIndex === -1;
  const completion = Math.max(0, Math.min(100, Math.round(amd.conf || 0)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {PHASES.map((p, i) => {
          const reached = !isNeutral && i <= activeIndex;
          const current = !isNeutral && i === activeIndex;
          return (
            <Fragment key={p}>
              <div className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${current ? 'bg-brand' : reached ? 'bg-brand/50' : 'bg-bg-800'}`} />
                
                <div
                  className={`mt-1 text-center text-3xs uppercase tracking-wider font-bold ${current ? 'text-brand' : reached ? 'text-ink-muted' : 'text-ink-dim'}`}>
                  
                  {SHORT[p]}
                </div>
              </div>
            </Fragment>);

        })}
      </div>

      <div className="rounded border border-line bg-bg-700 px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="text-3xs uppercase tracking-wider text-ink-dim">
            Current phase
          </span>
          <span
            className={`text-xs font-bold ${isNeutral ? 'text-ink-muted' : 'text-brand'}`}>
            
            {isNeutral ? 'Neutral' : amd.phase}
          </span>
        </div>
        {!isNeutral &&
        <div className="mt-2">
            <div className="flex items-center justify-between text-3xs text-ink-dim mb-1">
              <span>Phase completion</span>
              <span className="font-mono">{completion}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-800">
              <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{
                width: `${completion}%`
              }} />
            
            </div>
          </div>
        }
        <p className="mt-2 text-2xs leading-relaxed text-ink-muted">
          {amd.desc}
        </p>
      </div>
    </div>);

}