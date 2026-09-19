import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, "../assets/buildings/arc_triomphe.png");
const origBackup = path.resolve(__dirname, "../assets/buildings/arc_triomphe.prev.png");
const out = src;

const THRESH = 28;

if (!existsSync(origBackup)) {
  copyFileSync(src, origBackup);
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const outBuf = Buffer.from(data);

// Flood-fill near-black from edges → transparent
const visited = new Uint8Array(width * height);
const stack = [];
const isBg = (i) => {
  const o = i * 4;
  return outBuf[o] <= THRESH && outBuf[o + 1] <= THRESH && outBuf[o + 2] <= THRESH;
};
for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
for (let y = 0; y < height; y++) stack.push(y * width, y * width + (width - 1));
while (stack.length) {
  const i = stack.pop();
  if (i < 0 || i >= width * height || visited[i]) continue;
  visited[i] = 1;
  if (!isBg(i)) continue;
  outBuf[i * 4 + 3] = 0;
  stack.push(i - 1, i + 1, i - width, i + width);
}

const rgbaPng = await sharp(outBuf, { raw: { width, height, channels: 4 } }).png().toBuffer();

const { data: d2, info: i2 } = await sharp(rgbaPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let minX = i2.width,
  minY = i2.height,
  maxX = 0,
  maxY = 0;
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
const pad = 1;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(i2.width - 1, maxX + pad);
maxY = Math.min(i2.height - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
console.log("crop", { minX, minY, cw, ch, bottomWas: height - 1 - maxY });

const cropped = await sharp(rgbaPng)
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toBuffer();

// Fit ~ footprint 6x3 (192x96): keep plaza covering the plot, slight overhang OK
const footprintW = 6 * 32;
const targetW = Math.round(footprintW * 1.05); // ~202
const targetH = Math.round((ch / cw) * targetW);
console.log("target", targetW, targetH);

await sharp(cropped)
  .resize(targetW, targetH, { fit: "fill", kernel: "lanczos3" })
  .png()
  .toFile(out);

const final = await sharp(out).metadata();
console.log("FINAL", final.width, final.height);
console.log(JSON.stringify({ width: final.width, height: final.height }));
