/**
 * 실제 시스템이 AI 에게 주는 타일 사전을 그대로 덤프한다.
 *
 * 근거: src/editor/tools/tileQueryTool.ts 의 ask:"labels" 분기가 돌려주는 필드 —
 *   그룹: label(한국어 이름) · description · role · layerHome · patternKind · placementRules · passage
 *   낱개: tileId · label · description · role
 * 시공 프리미티브(build_wall/place_props/fill_region…)는 이 label 문자열을 material 로 받는다.
 *
 * 이전 실험에서 쓴 축약본(group|role|layer|passable|tiles)은 실제 표면보다 훨씬 빈약했다.
 * 설명·배치 규칙·패턴 문법이 빠지면 "사람이 만든 사전" 을 과소평가하게 된다.
 *
 * 산출: tmp-embed-lab/inputs/act4-dictionary.txt
 */
import fs from "node:fs";
import path from "node:path";
import { defaultTileset } from "../src/project/defaults/defaultAssets.ts";
import { approvedVocabulary } from "../src/project/tileVocabulary.ts";
import { COMBINED_TOWN_HARNESS_GROUPS } from "../src/project/tilesetHarness/combinedTownGroups.ts";

const tileset = defaultTileset();
const vocab = approvedVocabulary(tileset);
const byId = new Map(COMBINED_TOWN_HARNESS_GROUPS.map((g) => [g.id, g]));

const PASSAGE_KO = { passable: "밟을 수 있음", solid: "밟을 수 없음", star: "위로 지나감" };
const LAYER_KO = { lower: "하위(바닥)", upper: "상위(겹침)", perCell: "칸마다 다름", mixed: "혼합" };
const GRAMMAR_KO: Record<string, string> = {
  autotile_3x3: "오토타일 — 대표 타일을 칠하면 이웃 연결에 따라 변·모서리가 자동 선택됨",
  animated_terrain: "애니메이션 지형 — 프레임이 순환함",
  nine_slice_expandable: "9분할 확장 — 모서리 고정, 가운데 열/행을 반복해 크기를 키움",
  vertical_expandable: "세로 확장 — 위/아래 끝을 유지하고 가운데를 반복",
  horizontal_expandable: "가로 확장 — 좌/우 끝을 유지하고 가운데를 반복",
  source_rect: "원본 사각형 — 붙어 있는 그대로 옮겨 놓아야 함",
  overlay_detail: "겹침 장식 — 아래 타일을 지우지 않고 위에 얹음",
};

const lines: string[] = [];
lines.push("# 이 타일셋의 재료 사전");
lines.push("");
lines.push("아트 디렉터(사람)가 이 타일셋을 보고 손으로 작성한 것이다.");
lines.push("실제 제품에서 AI 는 타일 번호를 직접 고르지 않는다 — 아래 '이름' 을 재료로 지정하면");
lines.push("코드가 번호·레이어·오토타일 성형을 결정한다. 이 문서는 그 사전을 그대로 펼친 것이다.");
lines.push("");

for (const g of vocab.groups) {
  const src = byId.get(g.id);
  const tiles = src ? src.tileIds : [];
  lines.push(`## ${g.name}`);
  lines.push(`- 역할: ${g.role}`);
  lines.push(`- 레이어: ${LAYER_KO[g.layerHome] ?? g.layerHome}`);
  // approvedVocabulary 의 passage 는 4방향 PassFlag 객체다 — 하네스 그룹의 문자열 계약을 쓴다.
  const passage = src?.passage;
  if (passage) lines.push(`- 통행: ${PASSAGE_KO[passage] ?? passage}`);
  if (g.patternKind) lines.push(`- 확장 문법: ${GRAMMAR_KO[g.patternKind] ?? g.patternKind}`);
  if (g.description) lines.push(`- 설명: ${g.description}`);
  if (g.placementRules && g.placementRules !== g.description) lines.push(`- 배치 규칙: ${g.placementRules}`);
  if (tiles.length) lines.push(`- 타일 번호: ${tiles.join(" ")}`);
  // 하드 인접 규칙(조각난 오브젝트 방지) — 실제 배치 검증기가 강제하는 것
  const rules = src?.rules?.filter((r) => r.strength === "hard") ?? [];
  for (const r of rules) lines.push(`- 필수 규칙: ${r.message}`);
  lines.push("");
}

if (vocab.tiles.length) {
  lines.push("## 낱개 타일");
  for (const t of vocab.tiles) lines.push(`- ${t.tileId}: ${t.label}${t.layerHome ? ` (${LAYER_KO[t.layerHome] ?? t.layerHome})` : ""}`);
  lines.push("");
}

lines.push("## 주의");
lines.push("- '밟을 수 없음' 은 캐릭터가 지나갈 수 없다는 뜻이다. 겉보기와 다를 수 있다.");
lines.push("- 상위(겹침) 재료는 투명 배경이라 하위(바닥)에 깔면 아래가 검게 뚫린다. 반드시 바닥 위에 겹쳐라.");
lines.push("- '필수 규칙' 을 어기면 조각난 오브젝트가 되어 배치 검증에서 거부된다.");

const out = path.resolve("tmp-embed-lab/inputs/act4-dictionary.txt");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(`wrote ${out}`);
console.log(`그룹 ${vocab.groups.length}개 · 낱개 ${vocab.tiles.length}개 · ${Buffer.byteLength(lines.join("\n"), "utf8").toLocaleString()} bytes`);
console.log(`설명 있는 그룹 ${vocab.groups.filter((g) => g.description).length}개 · 배치규칙 ${vocab.groups.filter((g) => g.placementRules).length}개 · 패턴문법 ${vocab.groups.filter((g) => g.patternKind).length}개`);
