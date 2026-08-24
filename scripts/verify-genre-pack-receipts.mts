import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  verifyGenrePackAssertionReceipts,
} from "../src/project/genrePackReadiness";
import {
  OFFICIAL_GENRE_PACK_REQUIREMENTS,
} from "../src/project/officialGenrePackRequirements";

const receiptPath = process.argv[2];
if (!receiptPath) {
  console.error("Usage: npm run verify:genre-packs -- <assertion-receipts.json>");
  process.exit(2);
}

const parsed: unknown = JSON.parse(await readFile(resolve(receiptPath), "utf8"));
const receipts = Array.isArray(parsed) ? parsed : [];
const result = verifyGenrePackAssertionReceipts(OFFICIAL_GENRE_PACK_REQUIREMENTS, receipts);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
