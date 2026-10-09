// 공개 저장소 스냅샷에서 뺄 경로. 사전 스캔(prescan.mjs)과 내보내기가 같은 목록을 쓴다.
// 기준: 제품을 빌드·실행·기여하는 데 필요 없는 작업 증거·내부 기반·개인 자료.
// tiledata·harness-data 는 src 가 일부를 import 하므로 통째로 빼지 않는다 — 안의 제3자 자료는 따로 지운다.
export const PUBLIC_EXCLUDE = [
  ".omo", ".superpowers", ".vite-cache", ".kiro", ".infisical.json",
  "verify-shots", "output", "reports", "evidence", "docs", "design", "deprecated", "asset-backups",
  "infra", "rpg_maker_skills",
  "AI조수-작성방식-보고서.pdf", "problem.md", "review.md", "dbaudit.mjs",
  "Start RPG Maker.command",
  // 닌텐도 원작 걷기 그림(pret/pokeemerald)과 그것을 판형으로 쓴 후보. ATTRIBUTION 이 스스로 원작이라고 밝힌다.
  // 게임 번들에는 설치되지 않았고 하네스 안에서만 쓴다.
  "src/harnesses/pokemon-character-casting/references",
  "harness/pokemon-like-characters", // references 는 원작, variants·examples 는 원작과의 비교·파생(README)
  "harness-data/pokemon-character-casting",
  "scripts/asset-gen/pokemon-characters/references", // 브렌든 원작 걷기 그림(ATTRIBUTION.md 가 원작이라고 밝힘)
  "harness/pokemon-like-field-kit", // 포챠나 원작 필드 그림을 판형으로 쓴 파생 그림(README 45행)
  // 상용 팩·외부 내려받기 학습 자료. src 는 import 하지 않는다.
  "tiledata/rasak-fantasy", "tiledata/rasak-modern", "tiledata/refmap", "tiledata/pixel-art-world",
  // 저작권 정리로 지운 칩셋의 렌더가 박힌 파일·그 칩셋을 참조하는 예제(src 가 쓰지 않는다).
  "tiledata/tilesets/forest_harmony/recipes/reference-images.json", "public/places-mockup.html", "examples/saesol-red",
];

/** git pathspec 제외 목록. */
export const publicExcludePathspecs = () => PUBLIC_EXCLUDE.map((p) => `:(exclude,top)${p}`);

/** 경로가 공개본에 남는가. */
export const isPublicPath = (file) => !PUBLIC_EXCLUDE.some((p) => file === p || file.startsWith(`${p}/`));
