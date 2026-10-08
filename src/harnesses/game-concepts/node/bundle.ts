// bundle — 피드 라인업(시드 lineup, 지금 칩셋으로 지을 수 있는 받은 컨셉)을 앱 번들로 굽는다(오프라인·웹 편집기·스토어 오류 때 피드가 쓴다).
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { CONCEPT_FORMAT } from "../../../concepts/format";
import { imagePath, lineupCandidates, writeJsonAtomic } from "./data";

const PUBLIC_DIR = resolve("public/assets/concepts");
const JSON_PATH = resolve("src/assets/bundledConcepts.json");

export async function bundle(argv: string[]): Promise<number> {
  const { concepts: lineup, skipped } = lineupCandidates();
  for (const line of skipped) console.warn(`[bundle] 뺌 ${line}`);
  const size = argv.includes("--size") ? Number(argv[argv.indexOf("--size") + 1]) : lineup.length;
  const picked = lineup.slice(0, size);
  if (picked.length === 0) throw new Error("내보낼 컨셉이 없습니다. serve 에서 받고 시드 lineup 을 확인하세요.");
  mkdirSync(PUBLIC_DIR, { recursive: true });
  for (const name of readdirSync(PUBLIC_DIR)) if (name.endsWith(".webp")) rmSync(join(PUBLIC_DIR, name));
  const concepts = picked.map((concept) => {
    for (const size of ["full", "card"] as const) copyFileSync(imagePath(concept.slug, size), join(PUBLIC_DIR, `${concept.slug}.${size}.webp`));
    return { ...concept, thumb: { full: `/assets/concepts/${concept.slug}.full.webp`, card: `/assets/concepts/${concept.slug}.card.webp` } };
  });
  writeJsonAtomic(JSON_PATH, { format: CONCEPT_FORMAT, concepts });
  console.log(`[bundle] ${concepts.length}개 → ${JSON_PATH}, 그림 ${PUBLIC_DIR}`);
  return 0;
}
