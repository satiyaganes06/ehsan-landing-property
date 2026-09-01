import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { StripInjectedAttributes } from '@/components/strip-injected-attributes';
import { Providers } from './providers';
import './globals.css';

// Montserrat carries the whole panel. It has no serif or monospace cousin, so
// the display and mono roles point at it too; numeric alignment is handled
// with tabular figures in globals.css rather than a second family.
const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Ehsan Admin',
  description: 'Content management for Ehsan Plant & Property.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* The font variable has to live on <html>: globals.css sets
       `html { font-family: var(--font-sans) }`, and a variable declared on
       <body> is not visible to the element above it. */
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
      <body className="antialiased">
        <StripInjectedAttributes />
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
