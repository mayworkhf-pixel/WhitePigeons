'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DisciplineRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=strikes');
  }, [router]);
  return (
    <div className="text-center py-24 font-tech text-xs text-zinc-500 animate-pulse">
      REROUTING SEGMENT TO INTEGRATED DISCIPLINARY STRIKE GRIDS...
    </div>
  );
}
