'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WinsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=public-winlog');
  }, [router]);
  return (
    <div className="text-center py-24 font-tech text-xs text-zinc-500 animate-pulse">
      REROUTING SEGMENT TO INTEGRATED WIN LEDGER...
    </div>
  );
}
