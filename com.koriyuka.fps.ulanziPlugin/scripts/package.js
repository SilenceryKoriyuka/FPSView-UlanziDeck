// Builds the file people actually install: dist/com.koriyuka.fps.ulanziPlugin.zip
// The zip holds one top-level plugin folder with everything UlanziStudio needs to run it,
// node_modules included, so users never run npm or PowerShell.
// Also builds dist/github/: the source, minus node_modules and build output, ready to
// drag into GitHub's "Upload files" page (which ignores .gitignore).
// Usage: npm run package

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginFolder = path.basename(root);
const distDir = path.join(root, 'dist');
const stageDir = path.join(distDir, pluginFolder);
const zipPath = path.join(distDir, `${pluginFolder}.zip`);
const nodeModules = path.join(root, 'node_modules');

// What the running plugin needs. Dev-only files (scripts/, preview/, dist/, lockfile) stay out.
const INCLUDE = ['manifest.json', 'package.json', 'README.md', 'plugin', 'libs', 'property-inspector', 'assets', 'node_modules'];
const SKIP_IN_NODE_MODULES = new Set(['.bin', '.package-lock.json']);
const KOFFI_BINARY = path.join('node_modules', '@koromix', 'koffi-win32-x64', 'win32_x64', 'koffi.node');

if (!fs.existsSync(path.join(root, KOFFI_BINARY))) {
  throw new Error(`Missing ${KOFFI_BINARY}. Run "npm install" first.`);
}

fs.rmSync(distDir, { recursive: true, force: true });
for (const name of INCLUDE) {
  fs.cpSync(path.join(root, name), path.join(stageDir, name), {
    recursive: true,
    filter: src => !(path.dirname(src) === nodeModules && SKIP_IN_NODE_MODULES.has(path.basename(src)))
  });
}

// Windows' own bsdtar writes zip files when the name ends in .zip (-a).
const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-a', '-c', '-f', zipPath, '-C', distDir, pluginFolder]);

let files = 0;
let bytes = 0;
for (const entry of fs.readdirSync(stageDir, { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) {
    files++;
    bytes += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
}
const zipBytes = fs.statSync(zipPath).size;
console.log(`Packaged ${files} files (${(bytes / 1048576).toFixed(1)} MB unpacked)`);
console.log(`  ${zipPath} (${(zipBytes / 1048576).toFixed(1)} MB)`);

// Source for GitHub: repo README at the top, plugin folder beside it.
const githubDir = path.join(distDir, 'github');
const SKIP_FOR_GITHUB = new Set(['node_modules', 'dist', 'preview']);
fs.mkdirSync(path.join(githubDir, pluginFolder), { recursive: true });
fs.copyFileSync(path.join(root, '..', 'README.md'), path.join(githubDir, 'README.md'));
for (const name of fs.readdirSync(root)) {
  if (SKIP_FOR_GITHUB.has(name)) continue;
  fs.cpSync(path.join(root, name), path.join(githubDir, pluginFolder, name), { recursive: true });
}
const sourceFiles = fs.readdirSync(githubDir, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).length;
console.log(`  ${githubDir} (${sourceFiles} files for GitHub)`);
