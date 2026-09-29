import { Startup } from '@/components/loading/Startup';
import type { Metadata } from 'next';
import './globals.css';
import '@/components/loading/loading.css';
import '@/components/dashboard/dashboard.css';
import './design-system.css';
export const metadata: Metadata = {
  title: 'DataPilot AI — Your data, understood.',
  description:
    'A transparent, local data science workspace. Profile, explore, clean, and model your data with confidence.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.__datapilotStartedAt=performance.now();var saved;try{saved=localStorage.getItem('datapilot-theme')}catch{}document.documentElement.dataset.theme=saved==='dark'||saved==='light'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')})();`,
          }}
        />
      </head>
      <body>
        <Startup>{children}</Startup>
      </body>
    </html>
  );
}
