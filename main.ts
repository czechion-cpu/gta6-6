// SOLMAR BAY — the entrypoint that hands this game in (Node 22, stdlib
// only). The game itself is plain static files under game/ (index.html plus
// ES modules, no library, no network request), and the screenshots live in
// screenshots/. This program copies both into the output directory and
// writes dossier.json there with the vendored make.fun library, so the
// scorer can check the game and the judge can read it.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; inside the
// grader it defaults to /output. Both runs must write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate: the dossier text is capped at 160 KiB,
// screenshots at 4 files of 256 KiB each, game/ at 993 entries / 48 MiB.
// Passing them here makes this program fail exactly where the scorer
// would refuse the entry, instead of handing in something invalid.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
