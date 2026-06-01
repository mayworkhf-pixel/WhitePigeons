'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=role-request');
  }, [router]);
  return (
    <div className="text-center py-24 font-tech text-xs text-zinc-500 animate-pulse">
      REROUTING SEGMENT TO INTEGRATED DATA PORTAL...
    </div>
  );
}
