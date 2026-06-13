'use client';

import { useEffect, useState } from 'react';
import { Database, RefreshCw, Save, Shield, UserRound } from 'lucide-react';
import { useCurrentGuest, useDb, useMode } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer, PageHeader, LoadingGate } from '@/components/common/layout';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, Divider } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { guestInitials } from '@/lib/utils';

export default function ProfilePage() {
  const db = useDb();
  const mode = useMode();
  const guest = useCurrentGuest();
  const updateGuest = useStore((state) => state.updateGuest);
  const resetGuest = useStore((state) => state.resetGuest);
  const reseed = useStore((state) => state.reseed);
  const [nickname, setNickname] = useState('');

  useEffect(() => setNickname(guest?.display_name ?? ''), [guest?.display_name]);

  const owned = db.leagues.filter((league) => league.owner_guest_id === guest?.id);
  const joined = db.league_members.filter((member) => member.guest_id === guest?.id).length;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Guest profile" subtitle="Your temporary room identity" icon={<UserRound className="text-rift-cyan" />} />
      <LoadingGate>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Guest identity</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: guest?.avatar_color }}>
                  {guestInitials(guest?.display_name ?? '')}
                </span>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-slate-100">{guest?.display_name}</div>
                  <div className="truncate font-mono text-xs text-slate-600">{guest?.id}</div>
                </div>
              </div>
              <Divider />
              <Field label="Display name"><Input maxLength={32} value={nickname} onChange={(event) => setNickname(event.target.value)} /></Field>
              <div className="flex justify-end">
                <Button variant="primary" disabled={nickname.trim().length < 2 || nickname.trim() === guest?.display_name} onClick={() => updateGuest(nickname)}>
                  <Save size={15} /> Save nickname
                </Button>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            <Stat label="Owned rooms" value={owned.length} accent="#26d0ce" />
            <Stat label="Joined rooms" value={joined} />
            <Stat label="Storage mode" value={mode === 'mock' ? 'Local' : 'Supabase'} accent={mode === 'mock' ? '#c8a85a' : '#22c55e'} />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Database size={15} /> Session & storage</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-soft/40 p-3 text-sm text-slate-400">
                <Shield size={16} className="mt-0.5 shrink-0 text-rift-cyan" />
                <span>Your guest ID is stored in this browser. Resetting it creates a new identity and removes your current room permissions from this browser.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === 'mock' && (
                  <ConfirmButton variant="outline" confirmLabel="Reload demo data?" onConfirm={reseed}>
                    <RefreshCw size={15} /> Reload demo leagues
                  </ConfirmButton>
                )}
                <ConfirmButton variant="danger" confirmLabel="Reset guest identity?" onConfirm={resetGuest}>
                  <UserRound size={15} /> Change guest
                </ConfirmButton>
              </div>
            </CardBody>
          </Card>
        </div>
      </LoadingGate>
    </PageContainer>
  );
}
