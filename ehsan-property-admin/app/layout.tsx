import type { Metadata } from 'next';
import Script from 'next/script';
import './fonts.css';
import { Toaster } from '@/components/ui/sonner';
import { stripInjectedAttributes } from '@/components/strip-injected-attributes';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ehsan Admin',
  description: 'Content management for Ehsan Plant & Property.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Extensions (Grammarly, Bitdefender) write their markers onto <body>
          via dataset assignment, which bypasses the setAttribute patch in
          StripInjectedAttributes. Suppressing here covers this element's own
          attributes; it does not extend to children, so it hides nothing real. */}
      <body className="antialiased" suppressHydrationWarning>
        <Script id="strip-injected-attributes" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: stripInjectedAttributes }} />
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
