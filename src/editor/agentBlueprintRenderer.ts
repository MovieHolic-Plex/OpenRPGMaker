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

/** 라벨을 그릴 최대 칸 수 — 에셋이 수십 개인 대형 계획에서 텍스처를 낭비하지 않는다. */
export const BLUEPRINT_MAX_LABELS = 40;

interface StatusStyle {
  readonly color: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
  readonly strokeWidth: number;
  readonly labelAlpha: number;
}

/** 상태별 제도선 스타일 — 순수 매핑이라 렌더러 없이 테스트한다. */
export function blueprintStatusStyle(status: BlueprintEntryStatus): StatusStyle {
  if (status === "building") {
    return { color: BUILDING_COLOR, fillAlpha: 0.1, strokeAlpha: 0.95, strokeWidth: 2, labelAlpha: 1 };
  }
  if (status === "done") {
    return { color: DONE_COLOR, fillAlpha: 0, strokeAlpha: 0.34, strokeWidth: 1, labelAlpha: 0.5 };
  }
  return { color: BLUEPRINT_COLOR, fillAlpha: 0.045, strokeAlpha: 0.6, strokeWidth: 1, labelAlpha: 0.85 };
}

/** 캔버스에 찍을 라벨 문장. 도구명·에셋 id 를 노출하지 않는다. */
export function blueprintEntryCaption(entry: BlueprintEntry, total: number): string {
  const head = `${entry.order}/${total} ${entry.label}`;
  if (entry.status === "done") return `${head} ✓`;
  return head;
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
    // 계획 사각형과 라벨 40장이 위에 남았다. 이 토글이 유일한 "치우는" 수단이기도 하다 —
    // 나머지 경로(새 대화·대화 복원·프로젝트 전환·패널 닫기)는 대화까지 버린다.
    if (isAgentGhostPreviewHidden()) return;
    const state = getAgentBlueprintState();
    const entries = agentBlueprintForMap(state, this.mapId());
    if (entries.length === 0) return;

    const group = this.scene.add.container(0, 0);
    group.setName("agent-blueprint");
    this.layer.add(group);

    const withLabels = entries.length <= BLUEPRINT_MAX_LABELS;
    for (const entry of entries) {
      group.add(this.entryGraphic(entry));
      if (withLabels) {
        const label = this.entryLabel(entry, entries.length);
        if (label) group.add(label);
      }
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
    if (style.fillAlpha > 0) {
      graphics.fillStyle(style.color, style.fillAlpha);
      graphics.fillRect(x, y, width, height);
    }
    graphics.lineStyle(style.strokeWidth, style.color, style.strokeAlpha);
    graphics.strokeRect(x, y, width, height);
    return graphics;
  }

  private entryLabel(entry: BlueprintEntry, total: number): Phaser.GameObjects.Text | null {
    if (typeof this.scene.add.text !== "function") return null;
    const style = blueprintStatusStyle(entry.status);
    // 사각형 안쪽 위에 붙인다 — 맵 위쪽 경계(y=0)에서 화면 밖으로 나가지 않는다.
    const label = this.scene.add.text(entry.x * TILE_SIZE + 2, entry.y * TILE_SIZE + 2, blueprintEntryCaption(entry, total), {
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
