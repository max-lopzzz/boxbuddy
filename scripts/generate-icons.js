// scripts/generate-icons.js
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const sizes = [192, 512];
const source = path.join(__dirname, "..", "public", "illustrations", "logo.png");
const outDir = path.join(__dirname, "..", "public", "icons");

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of sizes) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 247, b: 237, alpha: 1 } })
      .toFile(path.join(outDir, `icon-${size}.png`));
  }
  console.log("Icons generated in public/icons/");
}

run();
