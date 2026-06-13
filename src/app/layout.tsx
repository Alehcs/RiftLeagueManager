import type { Metadata } from 'next';
import './globals.css';
import { StoreInitializer } from '@/components/layout/StoreInitializer';
import { Navbar } from '@/components/layout/Navbar';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Rift League Manager — LoL Esports League Simulator',
  description:
    'Create, import, manage and simulate League of Legends esports leagues — teams, rosters, transfers, schedules, standings & playoffs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <StoreInitializer />
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-xs text-slate-600">
            Rift League Manager · A LoL esports league simulator · Data is illustrative & fully editable
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
