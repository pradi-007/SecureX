import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DVRX — Vendor-Agnostic DVR/NVR Forensic Analysis Platform',
  description: 'Forensically sound acquisition, proprietary file system parsing, recovery, and audit tracking for surveillance video evidence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#05070a] text-slate-100 antialiased selection:bg-orange-500/30 selection:text-orange-300">
        {children}
      </body>
    </html>
  );
}
