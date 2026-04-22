'use client';

import dynamic from 'next/dynamic';

const AuthBox = dynamic(() => import('@/components/Auth/AuthBox'), { ssr: false });

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <AuthBox />
    </main>
  );
}
