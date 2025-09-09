'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') || 
                          localStorage.getItem('isAuthenticated');
    
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      // Redirect to main dashboard (which is the root page)
      router.push('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}