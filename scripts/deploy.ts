import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd: string, cwd?: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

async function deploy() {
  console.log('--- Rozpoczynam budowanie projektu do dist/ ---');
  run('npm run build');

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Folder dist/ nie istnieje!');
  }

  const gitDir = path.join(distDir, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  console.log('--- Wypychanie gotowej strony na gałąź gh-pages ---');
  run('git init', distDir);
  run('git checkout -B gh-pages', distDir);
  run('git add -A', distDir);
  run('git commit -m "Deploy to GitHub Pages"', distDir);
  run('git remote add origin https://github.com/lukeprawko/cs2.git', distDir);
  run('git push -f origin gh-pages', distDir);

  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  console.log('\n--- Sukces! Strona została zaktualizowana na gałęzi gh-pages! ---');
  console.log('Link: https://lukeprawko.github.io/cs2/\n');
}

deploy().catch((err) => {
  console.error('[BŁĄD DEPLOYU]:', err);
  process.exit(1);
});
