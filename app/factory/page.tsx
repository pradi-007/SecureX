'use client';

import dynamic from 'next/dynamic';

const AgenticFactory3D = dynamic(
  () => import('@/components/ui/agentic-factory-3d'),
  { ssr: false }
);

export default function FactoryPage() {
  return (
    <main className="w-full h-screen bg-black">
      <AgenticFactory3D height="100vh" />
    </main>
  );
}
