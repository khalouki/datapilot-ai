import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function LoadingSpinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="loading-spinner" aria-hidden="true" />;
}

export function LoadingButton({
  loading = false,
  loadingText = 'Processing…',
  children,
  disabled,
  className = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string }) {
  return (
    <button
      {...props}
      className={`${className} loading-button`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      <span className="loading-button-grid">
        <span
          className="loading-button-label"
          style={{ visibility: loading ? 'hidden' : undefined }}
          aria-hidden={loading || undefined}
        >
          {children}
        </span>
        <span
          className="loading-button-progress"
          style={{ visibility: loading ? undefined : 'hidden' }}
          aria-hidden={!loading || undefined}
        >
          <LoadingSpinner />
          <span>{loadingText}</span>
        </span>
      </span>
    </button>
  );
}

export function LoadingState({
  label = 'Loading analysis…',
  kind = 'charts',
  error,
  onRetry,
  announce = true,
}: {
  label?: string;
  kind?: 'overview' | 'charts' | 'table' | 'widget';
  error?: string;
  onRetry?: () => void;
  announce?: boolean;
}) {
  if (error)
    return (
      <div className="loading-error">
        <p role={announce ? 'alert' : undefined}>{error}</p>
        {onRetry && (
          <button className="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  return (
    <div
      className={`loading-state loading-${kind}`}
      aria-busy="true"
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
    >
      {announce && <span className="loading-caption">{label}</span>}
      <div className="skeleton-layout" aria-hidden="true">
        {kind === 'overview' ? (
          Array.from({ length: 4 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <i className="skeleton skeleton-label" />
              <i className="skeleton skeleton-value" />
            </div>
          ))
        ) : kind === 'table' ? (
          <div className="skeleton-table">
            {Array.from({ length: 6 }, (_, i) => (
              <i className="skeleton skeleton-row" key={i} />
            ))}
          </div>
        ) : (
          <div className="skeleton-chart">
            <i className="skeleton skeleton-label" />
            <div>
              {[35, 65, 45, 85, 55, 75, 60].map((h, i) => (
                <i className="skeleton" key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingOverlay({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="loading-region" aria-busy={active}>
      <div inert={active}>{children}</div>
      {active && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <LoadingSpinner size={24} />
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
