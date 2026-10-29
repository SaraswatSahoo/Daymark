// Generates PWA/app icons from public/icons/icon.svg. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile("public/icons/icon.svg");
const maskable = Buffer.from(
  svg.toString().replace('rx="8"', 'rx="0"').replace("<svg ", '<svg ').replace('viewBox="0 0 32 32"', 'viewBox="-6 -6 44 44"').replace("<rect width=\"32\"", '<rect x="-6" y="-6" width="44" height="44" fill="#5b4bd6"/><rect width="32"'),
);
await sharp(svg, { density: 1200 }).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg, { density: 1200 }).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(maskable, { density: 1200 }).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(svg, { density: 1200 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
await sharp(svg, { density: 1200 }).resize(72, 72).png().toFile("public/icons/badge-72.png");
await sharp(svg, { density: 1200 }).resize(64, 64).png().toFile("src/app/icon.png");
console.log("icons generated");
