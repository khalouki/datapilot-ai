'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { LoadingSpinner } from './Loading';

export function Startup({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const started =
      (window as Window & { __datapilotStartedAt?: number }).__datapilotStartedAt ??
      performance.now();
    // The only minimum duration is the startup anti-flash interval, measured from initial HTML.
    const remaining = Math.max(0, 500 - (performance.now() - started));
    const timer = window.setTimeout(() => setReady(true), remaining);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <div
        className="startup-splash"
        data-ready={ready}
        aria-hidden={ready || undefined}
        role={ready ? undefined : 'status'}
        aria-live="polite"
      >
        <div className="splash-logo">
          <GitBranch size={34} aria-hidden="true" />
        </div>
        <h1 translate="no">DataPilot AI</h1>
        <p>Data Intelligence</p>
        <span>
          <LoadingSpinner size={18} />
          <span>Preparing your workspace…</span>
        </span>
      </div>
      <div inert={!ready} aria-hidden={!ready || undefined}>
        {children}
      </div>
    </>
  );
}
