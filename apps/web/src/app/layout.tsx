import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/env';

import './globals.css';

interface RootLayoutProps {
  children: ReactNode;
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: 'Meeplewall', template: '%s | Meeplewall' },
    description: 'Board game collections from BoardGameGeek, shelved as 3D boxes.',
    openGraph: { siteName: 'Meeplewall', type: 'website' },
  };
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
