import { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://game-hub.krizad.com';

export const viewport: Viewport = {
  themeColor: '#FEF08A',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'KZ Game Hub',
  description:
    'KZ Game Hub — ศูนย์รวมบอร์ดเกมและปาร์ตี้เกมออนไลน์ เล่นกับเพื่อนได้แบบ Real-time ฟรี! ไม่ต้องโหลดแอป',
  applicationName: 'KZ Game Hub',
  keywords: [
    'KZ Game Hub',
    'บอร์ดเกมออนไลน์',
    'ปาร์ตี้เกม',
    'เกมเล่นกับเพื่อน',
    'บอร์ดเกม',
    'party games',
    'online board games',
    'krizad',
  ],
  authors: [{ name: 'KriZad', url: 'https://krizad.com' }],
  creator: 'KriZad',
  publisher: 'KriZad',
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    alternateLocale: ['en_US'],
    url: siteUrl,
    title: 'KZ Game Hub',
    description:
      'KZ Game Hub — ศูนย์รวมบอร์ดเกมและปาร์ตี้เกมออนไลน์ เล่นกับเพื่อนได้แบบ Real-time ฟรี! ไม่ต้องโหลดแอป',
    siteName: 'KZ Game Hub',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KZ Game Hub — ศูนย์รวมบอร์ดเกมและปาร์ตี้เกมออนไลน์',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KZ Game Hub',
    description:
      'KZ Game Hub — ศูนย์รวมบอร์ดเกมและปาร์ตี้เกมออนไลน์ เล่นกับเพื่อนได้แบบ Real-time ฟรี! ไม่ต้องโหลดแอป',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSansThai.className} antialiased min-h-screen`}>{children}</body>
    </html>
  );
}
