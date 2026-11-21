// Solmar Heat — entry program (Node, stdlib only).
// Copies game/ to the output directory and writes dossier.json.
// Run: node main.ts   (Node 22+ strips types; no dependencies, no build step)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot: string = path.dirname(fileURLToPath(import.meta.url));
const gameDir: string = path.join(repoRoot, 'game');

function pickOutputDir(): string {
  const preferred: string = process.env.MAKEFUN_OUTPUT || '/output';
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback: string = path.join(repoRoot, 'output');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function copyDir(src: string, dst: string): string[] {
  const copied: string[] = [];
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from: string = path.join(src, entry.name);
    const to: string = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copied.push(...copyDir(from, to));
    } else {
      fs.copyFileSync(from, to);
      copied.push(path.relative(dst, to).replace(/\\/g, '/'));
    }
  }
  return copied;
}

function main(): void {
  const outDir: string = pickOutputDir();
  const files: string[] = copyDir(gameDir, outDir);
  const dossier = {
    title: 'Solmar Heat',
    bounty: 'gta6-01',
    bounty_url: 'https://make.fun/bounty/gta6-01',
    description:
      '2D canvas top-down open-world crime game in the fictional coastal city of Solmar. ' +
      'Original protagonists Rico & Dante, 8 story missions, wanted levels 1-5, police AI, ' +
      'drivable cars, pedestrians, traffic, HUD and minimap. Original IP — no Rockstar / GTA assets.',
    entrypoint: 'index.html',
    files: files.sort(),
    missions: 8,
    controls: {
      drive_walk: 'WASD / arrow keys',
      run: 'Shift',
      action_enter_car: 'Space',
      start_mission: 'Enter',
      autopilot: 'P'
    },
    engine: 'plain JavaScript + Canvas 2D, no dependencies',
    test: 'node game/test.js (headless autopilot: all 8 missions)'
  };
  fs.writeFileSync(path.join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
  console.log('Solmar Heat -> ' + outDir);
  console.log('copied ' + files.length + ' files + dossier.json');
}

main();
