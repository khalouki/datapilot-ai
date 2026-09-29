'use client';
import { useRef, useState, type ReactNode } from 'react';
import { download } from '@/lib/api';
import { LoadingSpinner } from './Loading';
export function DownloadButton({
  path,
  filename,
  children,
}: {
  path: string;
  filename: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const locked = useRef(false);
  return (
    <span className="download-control">
      <a
        className="button"
        href={`/api${path}`}
        aria-busy={busy}
        aria-disabled={busy}
        onClick={async (event) => {
          event.preventDefault();
          if (locked.current) return;
          locked.current = true;
          setBusy(true);
          setError('');
          try {
            const blob = await download(path);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Could not prepare the download. Please try again.',
            );
          } finally {
            locked.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <>
            <LoadingSpinner />
            <span>Preparing download…</span>
          </>
        ) : (
          children
        )}
      </a>
      {error && (
        <span className="download-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
