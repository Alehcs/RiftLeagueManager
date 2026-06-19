import type { MatchFormat } from '@/lib/types';
import { Rng } from '@/lib/rng';
import type { TeamStrength } from './strength';

// ============================================================================
// Match simulator
//  - Win probability from a logistic of the strength gap.
//  - In BO3/BO5, per-game variance shrinks for the team with the macro/
//    consistency edge, so the steadier roster converts series more often.
//  - Generates plausible kills, gold diff and game duration from the margin.
// ============================================================================

export interface GameResult {
  game_number: number;
  winner: 'blue' | 'red';
  duration_minutes: number;
  blue_kills: number;
  red_kills: number;
  blue_gold: number;
  red_gold: number;
  notes: string;
  was_comeback?: boolean;
  pace?: 'stomp' | 'controlled' | 'close';
  initial_blue_win_probability?: number;
}

export interface MatchSimResult {
  winner: 'blue' | 'red';
  blue_score: number;
  red_score: number;
  games: GameResult[];
}

const WINS_NEEDED: Record<MatchFormat, number> = { BO1: 1, BO3: 2, BO5: 3 };

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Per-game blue win probability. `scale` controls upset frequency (lower = more
// deterministic). Macro/consistency edge tightens the gap in the steadier
// team's favor.
function gameWinProb(blue: TeamStrength, red: TeamStrength): number {
  const gap = blue.score - red.score;
  const steadiness =
    (blue.macroAvg + blue.consistencyAvg) / 2 - (red.macroAvg + red.consistencyAvg) / 2;
  const scale = 7.5; // ~+7.5 strength ≈ 73% game win
  return logistic((gap + steadiness * 0.25) / scale);
}

function simulateGame(
  gameNumber: number,
  blue: TeamStrength,
  red: TeamStrength,
  blueName: string,
  redName: string,
  rng: Rng,
): GameResult {
  const pBlue = gameWinProb(blue, red);
  const blueWins = rng.float() < pBlue;
  const winner = blueWins ? 'blue' : 'red';

  // Margin: how lopsided. Reflect strength gap + randomness.
  const edge = Math.abs(pBlue - 0.5) * 2; // 0..1
  const stomp = rng.float() < edge * 0.5; // strong favorite sometimes stomps
  const wasComeback = !stomp && rng.bool(blueWins === (pBlue >= 0.5) ? 0.18 : 0.42);

  const duration = Math.round(
    stomp ? rng.range(22, 28) : rng.range(28, 41) + (1 - edge) * 4,
  );

  const loserKills = Math.round(rng.range(2, 9) + (1 - edge) * 6);
  const winnerKills = Math.round(loserKills + rng.range(3, 12) + edge * 8);
  const goldDiff = Math.round((winnerKills - loserKills) * rng.range(280, 520) + edge * 4000);
  const baseGold = Math.round(duration * rng.range(1500, 1750));

  const wGold = baseGold + goldDiff;
  const lGold = baseGold;

  return {
    game_number: gameNumber,
    winner,
    duration_minutes: duration,
    blue_kills: blueWins ? winnerKills : loserKills,
    red_kills: blueWins ? loserKills : winnerKills,
    blue_gold: blueWins ? wGold : lGold,
    red_gold: blueWins ? lGold : wGold,
    notes: stomp
      ? `${winner === 'blue' ? blueName : redName} dominated early`
      : wasComeback
        ? `${winner === 'blue' ? blueName : redName} recovered from an early deficit`
        : '',
    was_comeback: wasComeback,
    pace: stomp ? 'stomp' : duration >= 36 ? 'close' : 'controlled',
    initial_blue_win_probability: Math.round(pBlue * 1000) / 1000,
  };
}

export function simulateMatch(
  format: MatchFormat,
  blue: TeamStrength,
  red: TeamStrength,
  opts: { blueName: string; redName: string; seed: string },
): MatchSimResult {
  const rng = new Rng('sim:' + opts.seed);
  const needed = WINS_NEEDED[format];
  const games: GameResult[] = [];
  let blueScore = 0;
  let redScore = 0;
  let n = 1;
  while (blueScore < needed && redScore < needed) {
    const g = simulateGame(n, blue, red, opts.blueName, opts.redName, rng);
    if (g.winner === 'blue') blueScore++;
    else redScore++;
    games.push(g);
    n++;
  }
  return {
    winner: blueScore > redScore ? 'blue' : 'red',
    blue_score: blueScore,
    red_score: redScore,
    games,
  };
}

// Quick headline win-probability for the UI (series-level, not per game).
export function seriesWinProbability(format: MatchFormat, blue: TeamStrength, red: TeamStrength): number {
  const p = gameWinProb(blue, red);
  const needed = WINS_NEEDED[format];
  if (needed === 1) return p;
  // P(win best-of-(2n-1)) summing binomial tail.
  const games = needed * 2 - 1;
  let prob = 0;
  for (let w = needed; w <= games; w++) {
    // exactly w wins in `games` with last game a win → combinations of (w-1 in games-1)
    prob += binom(games - 1, w - 1) * Math.pow(p, w) * Math.pow(1 - p, games - w);
  }
  return prob;
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
