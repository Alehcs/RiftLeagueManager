'use client';

import { useState } from 'react';
import type { Player, Team } from '@/lib/types';
import { useDb } from '@/lib/store/hooks';
import { teamById, leagueById } from '@/lib/store/selectors';
import { PlayerAvatar, TeamLogo } from '@/components/ui/image';
import { RoleBadge, OverallBadge } from '@/components/ui/rating';
import { PlayerStatusBadge, GeneratedBadge, ContractBadge } from '@/components/common/badges';
import { contractInfo } from '@/services/contracts';
import { isScouted, overallEstimate, formatEstimate } from '@/services/scouting';
import { PlayerDialog } from './PlayerDialog';
import { flagEmoji, formatMoney } from '@/lib/utils';

export function PlayerRow({ player, teams, canEdit, showTeam = true }: { player: Player; teams: Team[]; canEdit: boolean; showTeam?: boolean }) {
  const db = useDb();
  const team = teamById(db, player.team_id);
  const season = leagueById(db, player.league_id)?.season ?? '';
  const contract = contractInfo(player, season);
  const scouted = isScouted(player);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-left transition-colors hover:border-border-soft hover:bg-bg-elevated/70"
      >
        <PlayerAvatar name={player.nickname} src={player.image_url} seed={player.avatar_seed} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-slate-100">{player.nickname}</span>
            <RoleBadge role={player.role} />
            <ContractBadge status={contract.status} years={contract.years_remaining} />
            <GeneratedBadge show={player.generated} />
          </div>
          <div className="flex items-center gap-1.5 truncate text-xs text-slate-500">
            <span>{flagEmoji(player.nationality)}</span>
            <span className="truncate">{player.real_name || '—'}</span>
          </div>
        </div>

        {showTeam && (
          <div className="hidden items-center gap-1.5 sm:flex">
            {team ? (
              <>
                <TeamLogo name={team.name} shortName={team.short_name} src={team.logo_url} color={team.color_primary} size="xs" />
                <span className="text-xs text-slate-400">{team.short_name}</span>
              </>
            ) : (
              <PlayerStatusBadge status={player.status} />
            )}
          </div>
        )}

        <div className="hidden w-20 text-right text-xs sm:block">
          <div className="font-semibold text-slate-300">{formatMoney(player.value)}</div>
          <div className="text-slate-600">{formatMoney(player.salary)}/yr</div>
        </div>

        {scouted ? (
          <OverallBadge value={player.rating_overall} size="sm" />
        ) : (
          <span className="rounded-md border border-dashed border-border bg-bg-soft/60 px-1.5 py-0.5 text-xs font-semibold text-slate-400" title="Estimated — scout to reveal">~{formatEstimate(overallEstimate(player))}</span>
        )}
      </button>

      {open && <PlayerDialog player={player} open={open} onClose={() => setOpen(false)} teams={teams} canEdit={canEdit} />}
    </>
  );
}
