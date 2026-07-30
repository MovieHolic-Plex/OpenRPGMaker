import fs from "fs";
import path from "path";

const artifactDir = `C:/Users/USER/.gemini/antigravity-cli/brain/89d184a4-37a9-4bad-bc8a-1e903f6b09ca`;
const targetDir = path.resolve(process.cwd(), "public/assets/generated/monsters");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(artifactDir);
console.log("Checking artifact files:", files);

for (const file of files) {
  if (file.endsWith(".jpg") || file.endsWith(".png")) {
    const src = path.join(artifactDir, file);
    const dest = path.join(targetDir, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to ${dest}`);
  }
}
