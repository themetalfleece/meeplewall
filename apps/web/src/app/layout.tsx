import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/env';

import './globals.css';

interface RootLayoutProps {
  children: ReactNode;
}

export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: 'Board Games', template: '%s | Board Games' },
    description: 'Board game collections from BoardGameGeek, shelved as 3D boxes.',
    openGraph: { siteName: 'Board Games', type: 'website' },
  };
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
