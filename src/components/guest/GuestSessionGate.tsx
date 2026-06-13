'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useCurrentGuest, useReady } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { Button } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';

export function GuestSessionGate() {
  const ready = useReady();
  const guest = useCurrentGuest();
  const createGuest = useStore((state) => state.createGuest);
  const [name, setName] = useState('');

  if (!ready || guest) return null;

  const submit = () => {
    if (name.trim().length >= 2) createGuest(name);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 shadow-card">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rift-cyan/15 text-rift-cyan">
          <Users size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-50">Choose your nickname</h2>
        <p className="mt-2 text-sm text-slate-400">
          This temporary name identifies you in league rooms. No account or password is needed.
        </p>
        <div className="mt-5 space-y-3">
          <Input
            autoFocus
            maxLength={32}
            placeholder="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
          />
          <Button className="w-full" variant="primary" disabled={name.trim().length < 2} onClick={submit}>
            Enter as guest
          </Button>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-600">Your guest identity stays in this browser.</p>
      </div>
    </div>
  );
}
