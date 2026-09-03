// editor/agentBlueprintRenderer.ts
// 확정된 밑그림(BuildSpec)을 착공 전에 맵 위에 청사진으로 그린다.
//
// 연출을 늘리지 않는다(2026-08-28 결정: "복잡하게 하지 말고 그냥 좌에서 우로 한번에 쏵").
// 트윈·펄스·파티클 없이 상태를 선 굵기와 알파로만 구분한다 — 늘리는 것은 움직임이 아니라
// 정보(무엇을 · 어디에 · 몇 번째 · 끝났는지)다.
//
// 텍스트는 Phaser Text 로 그린다(editSceneEventMarkers 와 같은 규약: ui 폰트 스택 + zoom 반영
// resolution). DOM 마커를 쓰지 않으므로 새 CSS 가 필요 없다.

import type Phaser from "phaser";
import {
  agentBlueprintForMap,
  getAgentBlueprintState,
  type BlueprintEntry,
  type BlueprintEntryStatus,
} from "@/editor/agentBlueprint";
import { isAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
import { EVENT_LABEL_FONT_SIZE, eventLabelFontFamily, eventLabelResolution } from "@/editor/editSceneEventMarkers";
import { TILE_SIZE } from "@/assets/bundled";
import type { MapId } from "@/project/types";

/** 청사진 색 — 종이 위 제도선. 고스트 프리뷰(초록/청록)와 겹쳐도 구분된다. */
const BLUEPRINT_COLOR = 0x4dabf7;
const BUILDING_COLOR = 0xffd43b;
const DONE_COLOR = 0x868e96;
/**
 * 제도선 아래에 깔리는 어두운 테두리. 밝은 파랑 1px 만으로는 얼음·눈·모래 배경에서 계획이 보이지 않았다
 * (2026-09-03 실측: 얼음 대평원에서 계획 선 대비 1.5~1.6:1). 라벨 상자와 같은 색이라 한 어휘로 읽힌다.
 */
const HALO_COLOR = 0x0b1b2b;

/** 이 수를 넘으면 라벨을 순번만으로 줄인다 — 없애지 않는다(무엇이 어디에 몇 번째인지는 남아야 한다). */
export const BLUEPRINT_MAX_LABELS = 40;
/** 이보다 좁은 칸(1×1 주민 등)은 라벨을 순번만 찍는다 — 옆 칸 라벨과 한 덩이로 겹치지 않게. */
export const LABEL_MIN_WIDTH_TILES = 3;
/** 같은 자리에서 시작하는 라벨을 쌓을 때 한 줄의 높이(12px 글자 + 위아래 여백). */
export const LABEL_ROW_PX = 16;

interface StatusStyle {
  readonly color: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
  readonly strokeWidth: number;
  readonly labelAlpha: number;
  readonly haloColor: number;
  readonly haloAlpha: number;
}

/** 상태별 제도선 스타일 — 순수 매핑이라 렌더러 없이 테스트한다. */
export function blueprintStatusStyle(status: BlueprintEntryStatus): StatusStyle {
  if (status === "building") {
    return { color: BUILDING_COLOR, fillAlpha: 0.1, strokeAlpha: 0.95, strokeWidth: 2, labelAlpha: 1, haloColor: HALO_COLOR, haloAlpha: 0.6 };
  }
  if (status === "done") {
    return { color: DONE_COLOR, fillAlpha: 0, strokeAlpha: 0.34, strokeWidth: 1, labelAlpha: 0.5, haloColor: HALO_COLOR, haloAlpha: 0.25 };
  }
  return { color: BLUEPRINT_COLOR, fillAlpha: 0.06, strokeAlpha: 0.9, strokeWidth: 1, labelAlpha: 0.85, haloColor: HALO_COLOR, haloAlpha: 0.55 };
}

/** 캔버스에 찍을 라벨 문장. 도구명·에셋 id 를 노출하지 않는다. */
export function blueprintEntryCaption(entry: BlueprintEntry, total: number): string {
  const head = `${entry.order}/${total} ${entry.label}`;
  if (entry.status === "done") return `${head} ✓`;
  return head;
}

export interface BlueprintLabel {
  readonly entry: BlueprintEntry;
  readonly caption: string;
  /** 같은 좌상단에서 시작하는 라벨 중 몇 번째 줄인가(0부터). 렌더러가 LABEL_ROW_PX 만큼 내린다. */
  readonly row: number;
}

/**
 * 라벨 배치 — 순수 함수라 렌더러 없이 테스트한다.
 *
 * 실측(2026-09-03 e1-01·e1-04): 모든 칸에 같은 위치·같은 길이의 캡션을 찍으니 (1) 인접한 1×1 주민 셋이
 * 「8/ 9/ 10/12 주민」 한 덩이로 겹쳤고, (2) 집 모서리에 얹은 상위 장식(나무)의 라벨이 집 라벨을 완전히
 * 가렸고, (3) 41개부터는 라벨이 전부 사라져 순번도 종류도 알 수 없었다. 좁은 칸과 대형 계획은 순번만,
 * 같은 자리에서 시작하는 라벨은 줄을 내려 쌓는다.
 */
export function blueprintLabelLayout(entries: readonly BlueprintEntry[]): readonly BlueprintLabel[] {
  const compact = entries.length > BLUEPRINT_MAX_LABELS;
  const rowsByOrigin = new Map<string, number>();
  return entries.map((entry) => {
    const origin = `${entry.x},${entry.y}`;
    const row = rowsByOrigin.get(origin) ?? 0;
    rowsByOrigin.set(origin, row + 1);
    const short = compact || entry.w < LABEL_MIN_WIDTH_TILES;
    const caption = short
      ? `${entry.order}${entry.status === "done" ? " ✓" : ""}`
      : blueprintEntryCaption(entry, entries.length);
    return { entry, caption, row };
  });
}

type SceneWithPhaserObjects = Phaser.Scene & {
  readonly add: Phaser.GameObjects.GameObjectFactory;
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
};

export class AgentBlueprintRenderer {
  constructor(
    private readonly scene: SceneWithPhaserObjects,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly mapId: () => MapId | null
  ) {}

  render(): void {
    this.layer.removeAll(true);
    // 원본 보기(꾹 누름)는 조수가 덮은 것을 걷어 맵 자체를 보여주는 토글이다. 고스트는 스프라이트·
    // 애니메이션·DOM 마커 모두 이 값을 보는데(agentPreviewRenderers) 청사진만 보지 않아, 꾹 눌러도
    // 계획 사각형과 라벨 40장이 위에 남았다. 진행 중인 계획을 잠깐 걷는 유일한 수단이다 —
    // 나머지 경로(새 대화·대화 복원·프로젝트 전환·패널 닫기)는 대화까지 버린다. **다 지어진**
    // 계획은 이 토글을 기다리지 않는다: agentBlueprintForMap 이 전 칸 done 인 계획에 빈 목록을
    // 내므로 아래 `entries.length === 0` 에서 스스로 물러난다(그 함수 주석 참조).
    if (isAgentGhostPreviewHidden()) return;
    const state = getAgentBlueprintState();
    const entries = agentBlueprintForMap(state, this.mapId());
    if (entries.length === 0) return;

    const group = this.scene.add.container(0, 0);
    group.setName("agent-blueprint");
    this.layer.add(group);

    for (const placed of blueprintLabelLayout(entries)) {
      group.add(this.entryGraphic(placed.entry));
      const label = this.entryLabel(placed);
      if (label) group.add(label);
    }
  }

  clear(): void {
    this.layer.removeAll(true);
  }

  private entryGraphic(entry: BlueprintEntry): Phaser.GameObjects.Graphics {
    const style = blueprintStatusStyle(entry.status);
    const graphics = this.scene.add.graphics();
    const x = entry.x * TILE_SIZE;
    const y = entry.y * TILE_SIZE;
    const width = entry.w * TILE_SIZE;
    const height = entry.h * TILE_SIZE;
    // 원형·타원 힌트(fill_region.shape 와 같은 뜻): circle 은 사각형 안 내접 원, ellipse 는 사각형 안 타원.
    const round = entry.shape === "circle" || entry.shape === "ellipse";
    const diameter = entry.shape === "circle" ? Math.min(width, height) : 0;
    const ellipseW = entry.shape === "circle" ? diameter : width;
    const ellipseH = entry.shape === "circle" ? diameter : height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    if (style.fillAlpha > 0) {
      graphics.fillStyle(style.color, style.fillAlpha);
      if (round) graphics.fillEllipse(centerX, centerY, ellipseW, ellipseH);
      else graphics.fillRect(x, y, width, height);
    }
    // 어두운 테두리를 먼저 깔고 그 위에 제도선 — 밝은 배경에서도 선이 살아남는다.
    graphics.lineStyle(style.strokeWidth + 2, style.haloColor, style.haloAlpha);
    if (round) graphics.strokeEllipse(centerX, centerY, ellipseW, ellipseH);
    else graphics.strokeRect(x, y, width, height);
    graphics.lineStyle(style.strokeWidth, style.color, style.strokeAlpha);
    if (round) graphics.strokeEllipse(centerX, centerY, ellipseW, ellipseH);
    else graphics.strokeRect(x, y, width, height);
    return graphics;
  }

  private entryLabel(placed: BlueprintLabel): Phaser.GameObjects.Text | null {
    if (typeof this.scene.add.text !== "function") return null;
    const { entry } = placed;
    const style = blueprintStatusStyle(entry.status);
    // 사각형 안쪽 위에 붙인다 — 맵 위쪽 경계(y=0)에서 화면 밖으로 나가지 않는다. 같은 자리에서
    // 시작하는 라벨(집 모서리 위 장식 등)은 한 줄씩 내려 쌓아 서로 가리지 않는다.
    const label = this.scene.add.text(entry.x * TILE_SIZE + 2, entry.y * TILE_SIZE + 2 + placed.row * LABEL_ROW_PX, placed.caption, {
      backgroundColor: "#0b1b2b",
      color: "#e7f5ff",
      fontFamily: eventLabelFontFamily(),
      fontSize: EVENT_LABEL_FONT_SIZE,
      // cameras 는 테스트의 가짜 scene 에 없을 수 있다 — 옵셔널 체이닝 + zoom 1 폴백.
      resolution: eventLabelResolution(globalThis.devicePixelRatio, this.scene.cameras?.main?.zoom ?? 1),
      padding: { left: 3, right: 3, top: 1, bottom: 1 },
    });
    label.setAlpha(style.labelAlpha);
    return label;
  }
}
