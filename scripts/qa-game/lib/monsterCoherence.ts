// 노드 전용: 몬스터 종 다섯 면 일관성 게이트(src/project/monsterSpeciesCoherence)에 PNG 로더를 붙여 qa-game 검사 결과(Finding)로 바꾼다.
// `qa:game check` 가 부른다(--no-visual 로 끈다). 몬스터 수집 게임이 아니면 아무것도 하지 않는다.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { applyTransparentColorKey } from "../../../src/assets/transparentColorKey.ts";
import { isDeclaredMonsterGame } from "../../../src/project/genreLockMonsterAssets.ts";
import { auditMonsterSpeciesCoherence, type CoherenceRaster, type MonsterSpeciesCoherenceReport } from "../../../src/project/monsterSpeciesCoherence.ts";
import type { Finding } from "../../../src/qa/gameCheck/types.ts";
import type { Project } from "../../../src/project/types.ts";

/** 런타임 URL(`/assets/...` 또는 data URL) → RGBA. RTP 캐릭터셋처럼 좌상단이 불투명한 시트는 그 색을 투명 키로 본다(render.mts 와 같은 규칙). */
export function loadCoherenceRaster(url: string): CoherenceRaster | null {
  const file = /^\/?assets\//u.test(url) ? path.join("public", url.replace(/^\//u, "").split("?")[0]!) : null;
  const bytes = url.startsWith("data:image/png") ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
    : file && fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (!bytes) return null;
  try {
    const png = PNG.sync.read(bytes);
    const data = new Uint8ClampedArray(png.data);
    if (data[3] === 255) applyTransparentColorKey(data);
    return { width: png.width, height: png.height, data };
  } catch {
    return null;
  }
}

export function monsterCoherenceReport(project: Project): MonsterSpeciesCoherenceReport | null {
  if (!isDeclaredMonsterGame(project) || !(project.database.monsterSpecies ?? []).length) return null;
  return auditMonsterSpeciesCoherence(project, loadCoherenceRaster);
}

export function checkMonsterCoherence(project: Project): Finding[] {
  const report = monsterCoherenceReport(project);
  if (!report) return [];
  return report.findings.map((finding) => ({ severity: finding.severity, code: finding.code, message: finding.message }));
}
