// ============================================================================
// Asset service — team logos & player images.
// Real assets live across many public CDNs (Leaguepedia/Liquipedia/team sites)
// with non-deterministic URLs, so the app stores whatever URL is known and
// ALWAYS falls back to generated initials tiles (see <TeamLogo>/<PlayerAvatar>).
// These helpers produce *candidate* public URLs for the import adapters and a
// deterministic data-URI fallback used when no/working image exists.
// ============================================================================

import { colorFromString, initials } from '@/lib/utils';

// Best-effort candidate logo URLs from public wikis. The import preview lets an
// admin accept/replace these; broken links degrade to the initials tile.
export function candidateTeamLogoUrls(teamName: string): string[] {
  const titlecase = teamName.replace(/\s+/g, '_');
  return [
    `https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(titlecase)}logo_square.png`,
    `https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(titlecase)}logo_std.png`,
  ];
}

export function candidatePlayerImageUrls(nickname: string): string[] {
  const titlecase = nickname.replace(/\s+/g, '_');
  return [`https://lol.fandom.com/wiki/Special:FilePath/${encodeURIComponent(titlecase)}_2024_Split_2.png`];
}

// Deterministic inline SVG tile (data URI) for a team — used as <img> src when
// a logo is missing. Keeps the grid looking intentional rather than broken.
export function fallbackLogoDataUri(name: string, shortName?: string): string {
  const label = (shortName || initials(name, 3)).slice(0, 4);
  const color = colorFromString(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#0a0b10" stop-opacity="0.95"/>
    </linearGradient></defs>
    <rect width="120" height="120" rx="20" fill="url(#g)"/>
    <rect x="2" y="2" width="116" height="116" rx="18" fill="none" stroke="${color}" stroke-opacity="0.5"/>
    <text x="60" y="60" font-family="system-ui,sans-serif" font-size="${label.length > 3 ? 30 : 38}" font-weight="800"
      fill="#fff" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${escapeXml(label)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function fallbackAvatarDataUri(name: string): string {
  const label = initials(name, 2);
  const color = colorFromString(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#141622"/>
    <circle cx="60" cy="46" r="26" fill="${color}" fill-opacity="0.85"/>
    <rect x="22" y="78" width="76" height="46" rx="22" fill="${color}" fill-opacity="0.6"/>
    <text x="60" y="50" font-family="system-ui,sans-serif" font-size="26" font-weight="700"
      fill="#fff" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}
