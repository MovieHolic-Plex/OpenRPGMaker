// bundle — 받은 컨셉 중 분류마다 고르게 20개를 앱 비상용 번들로 굽는다(오프라인·웹 편집기·스토어 오류 때 피드가 쓴다).
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { CONCEPT_FORMAT } from "../../../concepts/format";
import { acceptedCandidates, currentImageSha, imagePath, readCheck, roundRobinByTag, writeJsonAtomic } from "./data";

const PUBLIC_DIR = resolve("public/assets/concepts");
const JSON_PATH = resolve("src/assets/bundledConcepts.json");

export async function bundle(argv: string[]): Promise<number> {
  const size = argv.includes("--size") ? Number(argv[argv.indexOf("--size") + 1]) : 20;
  // 받은 것 중 지금 그림에 대한 검사를 통과한 것을 분류 안에서 앞에 둔다(번들은 누구나 처음 보는 얼굴이다).
  const accepted = acceptedCandidates();
  const clean = new Set(accepted.filter((concept) => { const check = readCheck(concept.slug); return Boolean(check?.ok && check.imageSha === currentImageSha(concept.slug)); }).map((concept) => concept.slug));
  accepted.sort((a, b) => Number(!clean.has(a.slug)) - Number(!clean.has(b.slug)));
  const picked = roundRobinByTag(accepted).slice(0, size);
  if (picked.length === 0) throw new Error("받은 컨셉이 없습니다. serve 에서 먼저 고르세요.");
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
