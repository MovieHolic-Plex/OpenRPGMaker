// 저장소 계약 — `public/assets/generated/**` 에 dry-run 가짜가 승격돼 있지 않은가.
//
// 왜 필요한가(실측 2026-09-15): `scripts/oprn-generated-assets.mjs` 의 dry-run 은 실제 생성 대신 자체
// 가짜 PNG(`(x*17+y*31)%251`)를 쓴다. 그 가짜 5장이 승격돼 저장소에 들어가 있었고, 계획 파일은 그들을
// `status: "promoted"` 로 기록하고 있었다. 판정이 러너 안에만 있어서 **아무도 돌리지 않으면 조용했다.**
//
// 이 테스트는 저장소 전체를 훑어 그 부류를 잡는다. 아래 KNOWN_DAMAGED 는 **갚아야 할 부채**다 —
// 재생성 파이프라인이 돌면 그 목록이 줄어들고, 0장이 되는 순간 이 테스트는 "한 장도 없어야 한다" 로
// 조여진다(그 전까지는 목록에 없는 새 가짜가 나타나면 즉시 실패한다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { inspectPngFile } from "../scripts/lib/dryRunFakePng.mjs";

const ROOT = process.cwd();
const GENERATED = path.join(ROOT, "public", "assets", "generated");

/**
 * 알려진 손상 5장 — dry-run 가짜가 승격된 채로 커밋됐고, 재생성 파이프라인이 돌아야 복구된다.
 * 이력·Supabase 리소스 캐시 사본까지 전부 같은 가짜라 복원할 원본이 없다(.omo/evidence/generated-asset-fakes/README.md).
 */
const KNOWN_DAMAGED = [
  "public/assets/generated/starter/bronze-sword-icon.png",
  "public/assets/generated/starter/bronze-sword-image.png",
  "public/assets/generated/starter/hero-01-charset.png",
  "public/assets/generated/starter/potion-red-icon.png",
  "public/assets/generated/starter/potion-red-image.png",
];

/** 정상 그림 대조군 — 탐지기가 멀쩡한 그림을 가짜로 몰면 이 목록 검사가 무의미해진다. */
const KNOWN_GOOD = "public/assets/generated/starter/battle-icon-bag.png";

function collectPngs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectPngs(full));
    else if (entry.name.toLowerCase().endsWith(".png")) found.push(full);
  }
  return found;
}

test("생성 에셋에 dry-run 가짜가 승격돼 있지 않다(알려진 5장 외에는 0장)", () => {
  const fakes = [];
  for (const file of collectPngs(GENERATED)) {
    const result = inspectPngFile(file);
    if (result.error) continue; // 판독 불가 파일은 이 계약의 대상이 아니다
    if (result.dryRunFake) fakes.push(path.relative(ROOT, file).replaceAll("\\", "/"));
  }
  fakes.sort();
  const known = [...KNOWN_DAMAGED].sort();
  const unexpected = fakes.filter((file) => !known.includes(file));
  const repaired = known.filter((file) => !fakes.includes(file));

  assert.deepEqual(unexpected, [],
    `dry-run 가짜가 새로 승격됐다 — 실제 생성물을 승격하라:\n  ${unexpected.join("\n  ")}`);
  assert.deepEqual(repaired, [],
    `알려진 손상이 복구됐다 — KNOWN_DAMAGED 에서 빼라(부채가 줄었다):\n  ${repaired.join("\n  ")}`);
});

test("탐지기는 정상 그림을 가짜로 몰지 않는다", () => {
  const result = inspectPngFile(path.join(ROOT, KNOWN_GOOD));
  assert.equal(result.error, undefined, `${KNOWN_GOOD} 를 읽지 못했다: ${result.error}`);
  assert.equal(result.dryRunFake, false, `${KNOWN_GOOD} 을 가짜로 판정했다 — 탐지기가 과잉이다`);
});
