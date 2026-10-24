// Renders public/icons/icon.svg into the PNG sizes browsers and iOS need.
// Run with: node scripts/generate-icons.mjs
import sharp from "sharp";

const src = new URL("../public/icons/icon.svg", import.meta.url).pathname;
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

for (const size of [192, 512]) {
  await sharp(src).resize(size, size).png().toFile(out(`icon-${size}.png`));
}
// Maskable: full-bleed background with the artwork inside the safe zone.
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0d0b13" } })
  .composite([{ input: await sharp(src).resize(400, 400).png().toBuffer(), gravity: "center" }])
  .png()
  .toFile(out("icon-maskable-512.png"));
await sharp(src).resize(180, 180).flatten({ background: "#0d0b13" }).png().toFile(out("apple-touch-icon.png"));
console.log("icons written");
