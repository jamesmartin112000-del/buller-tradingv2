import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, HomeIcon } from 'lucide-react';

interface BackHomeLinkProps {
  className?: string;
  label?: string;
}

export function BackHomeLink({
  className = '',
  label = 'Back Home'
}: BackHomeLinkProps) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${className}`}
      aria-label="Return to home page">
      
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      <HomeIcon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </Link>);

}