import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src =
  "C:/Users/nieto/.cursor/projects/c-Users-nieto-Desktop-CURSOR/assets/c__Users_nieto_AppData_Roaming_Cursor_User_workspaceStorage_6da48cecf036d0c2b5f0e3d46e1b7c88_images_dollar1-0b86e908-c442-4a57-93b5-e80c4c4afbfb.jpg";
const outDir = path.resolve(__dirname, "../assets/buildings");
const origOut = path.join(outDir, "dollar_tower.orig.jpg");
const pngOut = path.join(outDir, "dollar_tower.png");

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

for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
for (let y = 0; y < height; y++) stack.push(y * width, y * width + (width - 1));

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
console.log("cleared", cleared);

const rgbaPng = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();

// Tight crop by opaque alpha
const { data: d2, info: i2 } = await sharp(rgbaPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let minX = i2.width, minY = i2.height, maxX = 0, maxY = 0;
for (let y = 0; y < i2.height; y++) {
  for (let x = 0; x < i2.width; x++) {
    if (d2[(y * i2.width + x) * 4 + 3] > 24) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const pad = 2;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(i2.width - 1, maxX + pad);
maxY = Math.min(i2.height - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
console.log("bbox", { minX, minY, cw, ch });

const cropped = await sharp(rgbaPng)
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toBuffer();

const targetH = 220;
const cMeta = await sharp(cropped).metadata();
const targetW = Math.max(1, Math.round((cMeta.width / cMeta.height) * targetH));
console.log("target", targetW, targetH);

await sharp(cropped)
  .resize(targetW, targetH, { fit: "fill", kernel: "lanczos3" })
  .png()
  .toFile(pngOut);

const finalMeta = await sharp(pngOut).metadata();
console.log("FINAL", finalMeta.width, finalMeta.height);
