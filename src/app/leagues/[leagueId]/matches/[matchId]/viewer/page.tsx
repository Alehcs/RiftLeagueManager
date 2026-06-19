'use client';

import { MatchSimulationViewer } from '@/components/simulation/MatchSimulationViewer';

export default function MatchViewerPage({ params }: { params: { leagueId: string; matchId: string } }) {
  return <MatchSimulationViewer leagueId={params.leagueId} matchId={params.matchId} />;
}

