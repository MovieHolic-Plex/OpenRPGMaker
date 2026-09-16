// editor/assistantViewTransition.ts
// 조수가 사용자 화면을 갈아 끼울 때 «자를 것인가 녹일 것인가» 의 유일한 판정.
//
// 왜 필요한가: 같은 맵 안의 이동은 이미 부드럽다 — `EditScene.panCameraToTile` 이 거리별
// 300–650ms smoothstep 으로 look-at 과 줌을 같은 시계에 태운다. 그런데 **맵이 바뀌면**
// `selectEditorMap` → `editorState.set({currentMapId})` → `redrawWhenViewStateChanges` 가
// 한 프레임에 캔버스를 통째로 갈아 끼우고, 카메라는 `planEditorCameraCenter(preserveLookAt:false)`
// 로 새 맵 한가운데에 붙는다. 사용자가 보는 것은 «하드컷 + 낯선 맵 중앙» 이고, 그 뒤에 팬까지
// 붙으면 한 번의 이동에 덜컹이 두 번 난다. 조수가 여러 맵을 오가는 턴에서 이게 반복된다.
//
// 맵 전환은 공간 연속성이 애초에 없다(같은 월드의 다른 좌표계다). 그래서 팬이 아니라
// **크로스페이드**가 맞는 어휘다: 옛 화면을 캔버스 종이색으로 덮고, 덮인 동안 맵과 카메라를
// 갈아 끼우고, 새 화면을 그 종이색에서 띄운다. 도착할 때 이미 프레이밍이 끝나 있으므로
// 낯선 맵을 가로지르는 팬이 사라진다.

import type { MapId } from "@/project/types";

export interface AssistantViewChange {
  /** 지금 열려 있는 맵. 아직 아무것도 안 열렸으면 null. */
  readonly fromMapId: MapId | null;
  readonly toMapId: MapId;
}

export interface AssistantViewTransitionOptions {
  /** `prefers-reduced-motion: reduce`. 켜져 있으면 전환을 **제거**한다(대체하지 않는다). */
  readonly reducedMotion: boolean;
  /** 덮을 캔버스가 실제로 붙어 있는가. 헤드리스·노드 테스트에서는 false. */
  readonly canDissolve: boolean;
}

export type AssistantViewTransitionPlan =
  | { readonly kind: "cut" }
  | { readonly kind: "dissolve"; readonly coverMs: number; readonly revealMs: number };

/**
 * 옛 화면이 종이색으로 잠기는 시간. 짧게 — 여기는 «정보가 사라지는» 구간이다.
 *
 * 왜 130 → 80 인가(2026-09-16): 목록에서 맵을 고르는 전환은 사용자가 **가장 자주** 보는
 * 전환인데, 감독이 「전환 속도가 너무 느리다」 고 했다. 실측(swiftshader, 40×30 맵)에서 클릭 →
 * 새 화면이 다 드러나기까지 847ms 였고, 그 구성은 덮기 130 + 베일 유지 428 + 걷기 200 +
 * 클릭·재구축 오버헤드 89 였다. 유지 구간은 새 맵이 실제로 그려지기를 기다리는 **필수**
 * 시간이라(줄이면 빈 종이색 캔버스가 드러난다 — 아래 `afterNextPaint`) 줄일 수 있는 것은
 * 페이드뿐이다. 80ms 는 60fps 에서 다섯 프레임이라 하드컷을 여전히 가리면서
 * 「기다렸다」 느낌을 주지 않는다.
 */
export const ASSISTANT_DISSOLVE_COVER_MS = 80;
/** 새 화면이 종이색에서 떠오르는 시간. 덮기보다 길게 — 여기가 «읽기 시작하는» 구간이다. */
export const ASSISTANT_DISSOLVE_REVEAL_MS = 120;
export function planAssistantViewTransition(
  change: AssistantViewChange,
  options: AssistantViewTransitionOptions
): AssistantViewTransitionPlan {
  if (!options.canDissolve || options.reducedMotion) return { kind: "cut" };
  // 덮을 이전 화면이 없다(부팅·프로젝트 교체 직후). 빈 캔버스를 페이드하면 «아무것도 아닌 것»이
  // 한 번 깜빡일 뿐이다.
  if (change.fromMapId === null) return { kind: "cut" };
  // 같은 맵이면 좌표계가 이어져 있다 — 팬이 «어디서 어디로» 를 보여 주는데, 그 앞에 베일을
  // 끼우면 출발점을 지워 연속성을 오히려 없앤다.
  if (change.fromMapId === change.toMapId) return { kind: "cut" };
  return { kind: "dissolve", coverMs: ASSISTANT_DISSOLVE_COVER_MS, revealMs: ASSISTANT_DISSOLVE_REVEAL_MS };
}

/**
 * 이미 떠 있는 베일에서 이어 덮을 시간.
 *
 * 조수가 연달아 맵을 갈아 끼우면 이전 디졸브가 아직 걷히는 중일 수 있다. 그때 새 디졸브를
 * 0 부터 다시 틀면 화면이 **밝아졌다가 다시 어두워진다** — 사용자가 세는 깜빡임이 두 배가 된다.
 * 지금 실제로 보이는 불투명도에서 남은 만큼만 덮으면 그 튐이 없다.
 */
export function remainingCoverMs(fullCoverMs: number, veilOpacity: number): number {
  const opacity = Number.isFinite(veilOpacity) ? Math.min(1, Math.max(0, veilOpacity)) : 0;
  return fullCoverMs * (1 - opacity);
}
