import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const src = path.resolve(webRoot, "../millionaire-city");
const exclude = new Set(["tools", "_tmp_sharp", "_ck", "node_modules"]);

let timer = null;
let running = false;
let queued = false;

function sync() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  queued = false;
  const child = spawn(process.execPath, [path.join(__dirname, "sync-game.mjs")], {
    cwd: webRoot,
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    running = false;
    const ok = code === 0;
    console.log(`[watch-game] sync ${ok ? "ok" : "failed"} (code ${code})`);
    if (queued) sync();
  });
}

console.log(`[watch-game] mirroring\n  ${src}\n→ ${path.resolve(webRoot, "public/game")}`);
sync();

const watcher = watch(src, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const top = filename.split(/[\\/]/)[0];
  if (exclude.has(top)) return;
  clearTimeout(timer);
  timer = setTimeout(sync, 250);
});

watcher.on("error", (err) => {
  console.error("[watch-game] watcher error", err);
  process.exit(1);
});
