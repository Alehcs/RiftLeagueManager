'use client';

import { useState } from 'react';
import { User, Save, Database, Shield, RefreshCw, Trash2 } from 'lucide-react';
import { useDb, useMode } from '@/lib/store/hooks';
import { useStore } from '@/lib/store/store';
import { PageContainer, PageHeader, LoadingGate } from '@/components/common/layout';
import { Card, CardHeader, CardTitle, CardBody, Button, Stat, Divider } from '@/components/ui/primitives';
import { ConfirmButton } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { PlayerAvatar } from '@/components/ui/image';

export default function ProfilePage() {
  const db = useDb();
  const mode = useMode();
  const currentUserId = useStore((s) => s.currentUserId);
  const updateProfile = useStore((s) => s.updateProfile);
  const reseed = useStore((s) => s.reseed);
  const hardReset = useStore((s) => s.hardReset);

  const profile = db.profiles.find((p) => p.id === currentUserId);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? '');

  const ownedLeagues = db.leagues.filter((l) => l.owner_user_id === currentUserId);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Profile" subtitle="Your account & local data" icon={<User className="text-rift-cyan" />} />
      <LoadingGate>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-4">
                <PlayerAvatar name={username || 'User'} src={avatar || null} size="xl" />
                <div>
                  <div className="text-lg font-bold text-slate-100">{profile?.username}</div>
                  <div className="text-sm text-slate-500">{profile?.email}</div>
                </div>
              </div>
              <Divider />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
                <Field label="Avatar URL"><Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" /></Field>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => updateProfile({ username, avatar_url: avatar || null })}><Save size={15} /> Save profile</Button>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            <Stat label="Owned leagues" value={ownedLeagues.length} accent="#26d0ce" />
            <Stat label="Total leagues" value={db.leagues.length} />
            <Stat label="Storage mode" value={mode === 'mock' ? 'Local' : 'Supabase'} accent={mode === 'mock' ? '#c8a85a' : '#22c55e'} />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Database size={15} /> Data & storage</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-soft/40 p-3 text-sm text-slate-400">
                <Shield size={16} className="mt-0.5 shrink-0 text-rift-cyan" />
                {mode === 'mock' ? (
                  <span>
                    Running in <b className="text-rift-gold">mock mode</b>. Your leagues persist in this browser (localStorage) and sync
                    live across open tabs. Add Supabase env vars to switch to a shared server database.
                  </span>
                ) : (
                  <span>Connected to <b className="text-rift-green">Supabase</b>.</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <ConfirmButton variant="outline" confirmLabel="Reload demo data?" onConfirm={reseed}>
                  <RefreshCw size={15} /> Reload demo leagues
                </ConfirmButton>
                <ConfirmButton variant="danger" confirmLabel="Erase ALL local data?" onConfirm={hardReset}>
                  <Trash2 size={15} /> Wipe & reseed
                </ConfirmButton>
              </div>
            </CardBody>
          </Card>
        </div>
      </LoadingGate>
    </PageContainer>
  );
}
