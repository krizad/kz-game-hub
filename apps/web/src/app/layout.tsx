import { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';
import { APP_VERSION } from '@repo/types';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KZ Game Hub',
  description: 'Real-time Insider Game Controller',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSansThai.className} antialiased min-h-screen`}>
        {children}
        <div className="fixed bottom-2 right-2 text-xs text-black/30 pointer-events-none z-50 font-medium">
          {APP_VERSION}
        </div>
      </body>
    </html>
  );
}
