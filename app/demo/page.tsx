import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import DemoOne from "@/components/ui/demo";

export default function DemoPage() {
  return (
    <main className="relative min-h-screen bg-black text-white p-2 sm:p-4 md:p-6">
      <div className="absolute top-6 left-6 z-50">
        <Link
          href="/"
          className="px-4 py-2 rounded-2xl liquid-glass text-xs font-mono text-slate-200 flex items-center gap-2 hover:text-white hover:border-orange-500/50 transition-all shadow-xl"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400" />
          <span>← Back to DVRX Dashboard</span>
        </Link>
      </div>
      <DemoOne />
    </main>
  );
}
