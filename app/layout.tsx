import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DVRX — Multi-Vendor DVR/NVR Forensic Analysis Tool',
  description: 'Forensically sound acquisition, proprietary file system parsing, recovery, and audit tracking for surveillance video evidence under Section 65B Indian Evidence Act.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#030712',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030712] text-slate-100 antialiased selection:bg-orange-500/30 selection:text-orange-300">
        {children}
      </body>
    </html>
  );
}
