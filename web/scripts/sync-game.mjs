import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const src = path.resolve(webRoot, "../millionaire-city");
const dest = path.resolve(webRoot, "public/game");
const exclude = new Set([
  "tools",
  "_tmp_sharp",
  "_tmp_ffmpeg",
  "_tmp_img",
  "_ck",
  "node_modules",
  ".git",
]);

if (!existsSync(src)) {
  if (existsSync(dest)) {
    console.log(`[sync-game] source missing (${src}); keeping existing ${dest}`);
    process.exit(0);
  }
  console.error(`[sync-game] missing source: ${src}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

function shouldSkip(name) {
  return exclude.has(name);
}

function mirror(from, to) {
  mkdirSync(to, { recursive: true });
  const entries = readdirSync(from, { withFileTypes: true });
  const keep = new Set();

  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    keep.add(entry.name);
    if (entry.isDirectory()) {
      mirror(fromPath, toPath);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      cpSync(fromPath, toPath);
    }
  }

  for (const name of readdirSync(to)) {
    if (shouldSkip(name) || keep.has(name)) continue;
    rmSync(path.join(to, name), { recursive: true, force: true });
  }
}

mirror(src, dest);
console.log(`[sync-game] mirrored\n  ${src}\n→ ${dest}`);
