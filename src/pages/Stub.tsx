import React from 'react';
import { ConstructionIcon } from 'lucide-react';
interface StubProps {
  title: string;
  description?: string;
}
export function Stub({ title, description }: StubProps) {
  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="bg-bg-600 border border-line rounded-md p-8">
        <div className="w-12 h-12 rounded-md bg-brand/10 border border-brand/25 flex items-center justify-center mb-4">
          <ConstructionIcon className="w-6 h-6 text-brand" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          {description ||
          'This module is part of the institutional engine and is being prepared. Core signal engine, live data, and dashboard are fully operational.'}
        </p>
        <div className="mt-4 inline-block text-2xs uppercase tracking-wider font-bold text-warn border border-warn/30 bg-warn/10 px-2 py-1 rounded">
          Prototype · Coming Online Soon
        </div>
      </div>
    </div>);

}