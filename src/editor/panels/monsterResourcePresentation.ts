import { getMonsterResource } from "@/assets/monsterResourceCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PIXEL_ENEMY_CELL_INDEX, pixelEnemyCell, pixelEnemySheetUrl, projectPixelEnemySheet, bundledPixelEnemySheet, type PixelEnemySheet } from "@/assets/pixelEnemySheets";
import { applyMagentaChromaKey } from "@/editor/panels/chromaKey";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type MonsterResource = NonNullable<ReturnType<typeof getMonsterResource>>;
const ORIGIN_LABELS = { bundled: "기본 제공", uploaded: "업로드", profile: "프로필" } as const;
const REVIEW_LABELS = { reviewed: "검토됨", unreviewed: "미검토" } as const;
export const MONSTER_METADATA_SOURCE_LABELS = { project: "프로젝트 편집", catalog: "기본 카탈로그", fallback: "기본 표시값" } as const;

export function monsterResourceStatus(resource: MonsterResource): string {
  return `${ORIGIN_LABELS[resource.origin]} · ${REVIEW_LABELS[resource.reviewStatus]}`;
}

/** 전투가 이 소재를 3×3·4×4 시트로 움직이면 그 시트(업로드가 id 를 덮으면 그 업로드의 시트만). */
function battleSheet(resourceId: string, project: Project): PixelEnemySheet | undefined {
  const authored = projectPixelEnemySheet(resourceId, project);
  if (authored || Object.hasOwn(project.assets.uploaded, resourceId)) return authored;
  return bundledPixelEnemySheet(resourceId);
}

/**
 * 몬스터 소재 미리보기. animate 이면 전투 도트 시트가 있는 소재는 대기 a→b→c→b 루프를 CSS 로 돌린다(스토어 몬스터 포함).
 * 목록 썸네일은 animate 없이 정지 그림이다 — 행마다 루프를 돌리지 않는다.
 */
export function monsterResourcePreview(resource: MonsterResource, project: Project, options: { readonly animate?: boolean } = {}): HTMLElement {
  const frame = el("div", { class: "db-monster-resource-preview" });
  const sheet = options.animate ? battleSheet(resource.resourceId, project) : undefined;
  if (sheet) {
    const cell = pixelEnemyCell(sheet);
    const sprite = el("span", {
      class: "db-monster-resource-sheet",
      attrs: { role: "img", "aria-label": `${resource.name} 전투 대기 동작` },
      dataset: { testid: "db-monster-resource-sheet", motion: sheet.motion, cell: String(cell) },
    });
    sprite.style.setProperty("--monster-sheet-url", `url("${pixelEnemySheetUrl(sheet)}")`);
    sprite.style.setProperty("--monster-sheet-idle-ms", `${sheet.idleFrameMs * 4}ms`);
    sprite.style.setProperty("--monster-sheet-size", `${Math.min(160, cell * 2)}px`);
    frame.dataset.battleMotion = sheet.motion;
    frame.append(sprite);
    if (sheet.grid === "4x4") {
      // 16칸 시트: 대기 루프 옆에 칸 전부를 이름과 함께 펼친다. 빠진 칸(missingCells)은 흐리게 「없음」.
      sprite.dataset.grid = "4x4";
      frame.dataset.grid = "4x4";
      frame.append(monsterSheetCells(sheet, resource.name));
    }
    return frame;
  }
  const url = resolveAssetResourceUrl(resource.resourceId, { project });
  if (!url) {
    frame.textContent = "미리보기를 사용할 수 없습니다.";
    return frame;
  }
  const image = el("img", {
    attrs: { src: url, alt: `${resource.name} 미리보기`, loading: "lazy", width: "160", height: "160" },
  });
  image.addEventListener("error", () => {
    frame.replaceChildren(el("span", { text: "그림을 불러오지 못했습니다." }));
  }, { once: true });
  applyMagentaChromaKey(image);
  frame.append(image);
  return frame;
}

const CELL_LABELS: Readonly<Record<keyof typeof PIXEL_ENEMY_CELL_INDEX, string>> = {
  idle_a: "대기 a", idle_b: "대기 b", idle_c: "대기 c", windup: "준비", move: "이동", attack: "공격", recover: "복귀", hit: "피격", dead: "쓰러짐",
  attack_mid: "공격 중간", cast_charge: "시전 모으기", cast_release: "시전 방출", guard: "막기", weak: "빈사", intro: "등장",
};

/** 4×4 시트의 15칸(15번 예약 칸 제외)을 작은 격자로. 칸 그림은 같은 시트 URL 의 배경 위치로 자른다. */
function monsterSheetCells(sheet: PixelEnemySheet, name: string): HTMLElement {
  const grid = el("div", { class: "db-monster-sheet-cells", attrs: { role: "list", "aria-label": `${name} 전투 칸 15개` }, dataset: { testid: "db-monster-sheet-cells" } });
  const url = `url("${pixelEnemySheetUrl(sheet)}")`;
  const missing = new Set(sheet.missingCells ?? []);
  for (const [cell, index] of Object.entries(PIXEL_ENEMY_CELL_INDEX) as [keyof typeof PIXEL_ENEMY_CELL_INDEX, number][]) {
    const absent = missing.has(index);
    const item = el("div", { class: "db-monster-sheet-cell", attrs: { role: "listitem" }, dataset: { cell, index: String(index), ...(absent ? { missing: "true" } : {}) } });
    const swatch = el("span", { class: "db-monster-sheet-cell-image", attrs: { "aria-hidden": "true" } });
    swatch.style.setProperty("--monster-sheet-url", url);
    swatch.style.backgroundPosition = `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * (100 / 3)}%`;
    item.append(swatch, el("small", { text: absent ? `${CELL_LABELS[cell]} · 없음` : CELL_LABELS[cell] }));
    grid.append(item);
  }
  return grid;
}

/** Plain text only: authored metadata is reference data, never markup. */
export function monsterResourceSummary(project: Project, resourceId: string): HTMLElement {
  const resource = getMonsterResource(project, resourceId);
  const summary = el("div", { class: "db-monster-resource-summary", dataset: { testid: "monster-resource-summary", resourceId } });
  if (!resource) {
    summary.textContent = "등록된 몬스터 소재가 아닙니다.";
    return summary;
  }
  summary.append(
    el("strong", { text: resource.name }),
    el("span", { text: resource.tags.join(" · ") }),
    el("p", { text: resource.description }),
    el("small", { text: monsterResourceStatus(resource), dataset: { origin: resource.origin, reviewStatus: resource.reviewStatus } }),
  );
  return summary;
}
