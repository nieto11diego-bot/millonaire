import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src =
  "C:/Users/nieto/.cursor/projects/c-Users-nieto-Desktop-CURSOR/assets/c__Users_nieto_AppData_Roaming_Cursor_User_workspaceStorage_6da48cecf036d0c2b5f0e3d46e1b7c88_images_brasil2-68a4fe99-67e4-480e-bf11-aaf2617816f0.jpg";
const outDir = path.resolve(__dirname, "../assets/buildings");
const origOut = path.join(outDir, "san_basilio.orig.jpg");
const pngOut = path.join(outDir, "san_basilio.png");
const prevOut = path.join(outDir, "san_basilio.prev.png");

const THRESH = 40;

copyFileSync(src, origOut);

const meta = await sharp(src).metadata();
console.log("src", meta.width, meta.height, meta.format);

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const out = Buffer.from(data);

const visited = new Uint8Array(width * height);
const stack = [];
const isBg = (i) => {
  const o = i * 4;
  return out[o] <= THRESH && out[o + 1] <= THRESH && out[o + 2] <= THRESH;
};

for (let x = 0; x < width; x++) {
  stack.push(x, (height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  stack.push(y * width, y * width + (width - 1));
}

let cleared = 0;
while (stack.length) {
  const i = stack.pop();
  if (i < 0 || i >= width * height || visited[i]) continue;
  visited[i] = 1;
  if (!isBg(i)) continue;
  out[i * 4 + 3] = 0;
  cleared++;
  stack.push(i - 1, i + 1, i - width, i + width);
}
console.log("cleared pixels", cleared);

// Fringe cleanup
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const o = i * 4;
    if (out[o + 3] === 0) continue;
    if (out[o] > THRESH + 15 || out[o + 1] > THRESH + 15 || out[o + 2] > THRESH + 15) continue;
    let tn = 0;
    for (const d of [-1, 1, -width, width]) {
      if (out[(i + d) * 4 + 3] === 0) tn++;
    }
    if (tn >= 2) {
      out[o + 3] = 0;
      cleared++;
    }
  }
}

const rgbaPng = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
await sharp(rgbaPng).toFile(prevOut);

const trimmedBuf = await sharp(rgbaPng).trim({ threshold: 8 }).png().toBuffer();
const tMeta = await sharp(trimmedBuf).metadata();
console.log("trimmed", tMeta.width, tMeta.height);

// Scale to height 240 (same as torre_pisa), width proportional; clamp width to ~ footprint*1.5
const targetH = 240;
const targetW = Math.max(1, Math.round((tMeta.width / tMeta.height) * targetH));
console.log("target", targetW, targetH);

await sharp(trimmedBuf)
  .resize(targetW, targetH, { fit: "fill", kernel: "lanczos3" })
  .png()
  .toFile(pngOut);

const finalMeta = await sharp(pngOut).metadata();
console.log("FINAL", finalMeta.width, finalMeta.height);
