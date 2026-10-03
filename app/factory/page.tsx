'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, HardDrive, Shield } from 'lucide-react';

const AgenticFactory3D = dynamic(
  () => import('@/components/ui/agentic-factory-3d'),
  { ssr: false }
);

export default function FactoryPage() {
  return (
    <main className="relative w-full h-screen bg-[#030712] overflow-hidden">
      {/* Floating Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto px-4 py-2 rounded-2xl liquid-glass liquid-glass-interactive text-xs font-mono text-slate-200 flex items-center gap-2 hover:text-white hover:border-orange-500/50 transition-all shadow-xl"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400" />
          <span>← Back to DVRX Dashboard</span>
        </Link>

        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass text-xs font-mono text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>SURVEILLANCE HARDWARE FORENSIC DIGITAL TWIN</span>
        </div>
      </div>

      <AgenticFactory3D height="100vh" />
    </main>
  );
}
