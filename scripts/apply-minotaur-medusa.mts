import fs from "fs";
import path from "path";
import zlib from "zlib";
import { defaultBattleRecords } from "../src/project/defaults/defaultDatabaseBattleRecords";
import { saveProjectToSupabase } from "../src/project/supabaseProjectSync";
import { createBlankProject } from "../src/project/defaults";

const artifactDir = `C:/Users/USER/.gemini/antigravity-cli/brain/89d184a4-37a9-4bad-bc8a-1e903f6b09ca`;
const targetDir = path.resolve(process.cwd(), "public/assets/generated/monsters");

console.log("Applying dedicated AI images for Minotaur and Medusa...");

const minotaurSrc = path.join(artifactDir, "monster_minotaur_hero_1784924403939.jpg");
const medusaSrc = path.join(artifactDir, "monster_medusa_gorgon_1784924413244.jpg");

const minotaurDest = path.join(targetDir, "monster_minotaur.jpg");
const medusaDest = path.join(targetDir, "monster_medusa.jpg");

if (fs.existsSync(minotaurSrc)) fs.copyFileSync(minotaurSrc, minotaurDest);
if (fs.existsSync(medusaSrc)) fs.copyFileSync(medusaSrc, medusaDest);

console.log("Copied dedicated Minotaur and Medusa JPG files to public/assets/generated/monsters/!");
