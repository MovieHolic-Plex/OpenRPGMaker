// editor/clusterAssistRecovery.ts
//
// 손으로 칠하다 hard 클러스터 규칙에 막혔을 때 **되살아날 길**을 소유한다 (OPRN-OUT-017).
//
// 왜 별 파일인가: 거부는 지금까지 `paintTilesBulk` 안에서 토스트 한 줄로 끝났고, 사용자에게는
// 「붓이 잠겼다」로 보였다(원 보고: 합본마을 나무밑동 290~292). 복구는 세 가지를 동시에 쥐어야
// 한다 — (1) 규칙·동반 타일·좌표를 말하는 사람 문장, (2) 그 자리에서 누를 수 있는 정확 배치
// 행동, (3) 그 행동이 **한 번의 되돌리기 단위**라는 보장. 이걸 TilePaintEngine 안에 두면
// 스트로크 상태 기계와 얽혀 테스트가 브라우저를 요구한다. 순수 모델은 여기, 표시만 저기.
//
// 두 보조는 **독립**이다:
//   - autoConnectMode  : 지형 오토타일(흙길·모래·실내 벽) 이웃 성형
//   - clusterAssistMode: hard 클러스터 동반 칸(나무 수관, 벤치 짝, 문 상하) 자동 배치
// 예전에는 「이웃 연결: 수동」 하나가 둘 다 끈다고 읽혔지만 실제로는 앞의 것만 껐다.

import { paintTilesBulk, type TileLayer, type TilePaintRejection } from "@/editor/tileActions";
import { editorState } from "@/editor/editorState";
import { recordMapEditIfChanged } from "@/editor/mapEditHistory";
import type { MapId } from "@/project/types";
import { toast, type ToastAction } from "@/util/toast";

export type ClusterRecoveryOffer = {
  /** 토스트 본문 — 규칙·동반 타일·좌표가 모두 들어간다. */
  readonly message: string;
  /** 정확 배치를 실행하는 행동. 복구 불가(보호셀·다른 덧그림)면 null. */
  readonly action: ClusterRecoveryAction | null;
  /** 복구 불가일 때 사람이 다음에 할 일. */
  readonly hint: string | null;
};

export type ClusterRecoveryAction = {
  readonly label: string;
  readonly layer: TileLayer;
  readonly mapId: MapId;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
};

/**
 * 거부 → 사람에게 보여 줄 제안. 순수 함수 — DOM 도 store 도 만지지 않는다.
 *
 * 수용 기준 「거부는 조용한 무동작이 아니라 실행 가능한 복구 경로를 제시한다」의 계산부다.
 */
export function clusterRecoveryOffer(mapId: MapId, rejection: TilePaintRejection): ClusterRecoveryOffer {
  const message = `보조 배치 실패 — ${rejection.reason}`;
  if (!rejection.recoverable) {
    return {
      action: null,
      hint: "이 칸만 정확히 배치하는 것도 막혀 있습니다 — 먼저 그 칸을 비우거나 이벤트를 옮기세요.",
      message,
    };
  }
  return {
    action: {
      label: `이 칸만 정확히 배치 (${rejection.tile})`,
      layer: rejection.layer,
      mapId,
      tile: rejection.tile,
      x: rejection.x,
      y: rejection.y,
    },
    hint: null,
    message,
  };
}

/**
 * 정확 배치를 **한 번의 저작 행동**으로 적용한다. 되돌리기 한 번이 이 배치 전체를 원복하고,
 * 다시 실행하면 같은 결과가 온다 — 토스트 버튼에서 눌러도 일반 붓질과 같은 단위다.
 *
 * 실제로 바뀐 게 없으면 히스토리에 아무것도 쌓지 않는다(redo 보존, `recordMapEditIfChanged` 계약).
 */
export function applyExactPlacement(action: ClusterRecoveryAction): boolean {
  const rejections: TilePaintRejection[] = [];
  recordMapEditIfChanged(action.mapId, () => {
    paintTilesBulk(
      action.mapId,
      [{ layer: action.layer, tile: action.tile, x: action.x, y: action.y }],
      {
        autoConnect: false,
        exactPlacement: true,
        onRejected: (rejection) => rejections.push(rejection),
      },
    );
  });
  const blocked = rejections[0];
  if (blocked) {
    toast(`정확 배치도 거부됨 — ${blocked.reason}`, "error");
    return false;
  }
  return true;
}

/**
 * 손붓 페인트의 옵션. 보조가 꺼져 있으면 처음부터 정확 배치로 칠한다(거부가 애초에 없다).
 * 보조가 켜져 있으면 예전과 같은 원자적 동반 배치를 하고, 실패는 복구 제안으로 흐른다.
 */
export function freehandPaintOptions(input: {
  readonly clusterAssist: boolean;
  readonly autoConnect: boolean;
  readonly onRejected: (rejection: TilePaintRejection) => void;
}): { readonly autoConnect: boolean; readonly exactPlacement?: true; readonly onRejected: (rejection: TilePaintRejection) => void } {
  return input.clusterAssist
    ? { autoConnect: input.autoConnect, onRejected: input.onRejected }
    : { autoConnect: input.autoConnect, exactPlacement: true, onRejected: input.onRejected };
}

/** 제안을 토스트로 띄운다 — 문장과 버튼이 같은 알림에 함께 있어야 행동으로 이어진다. */
export function presentClusterRecovery(offer: ClusterRecoveryOffer, onApplied?: () => void): void {
  const recovery = offer.action;
  const action: ToastAction | undefined = recovery
    ? {
      label: recovery.label,
      onClick: () => {
        if (applyExactPlacement(recovery)) onApplied?.();
      },
      testid: "cluster-exact-place",
    }
    : undefined;
  toast(offer.hint ? `${offer.message} · ${offer.hint}` : offer.message, {
    kind: "error",
    ...(action ? { action } : {}),
  });
}

/** 두 보조가 UI 에서 서로 다른 계약임을 말하는 문장 — 팔레트 칩과 도움말이 같은 문구를 쓴다. */
export function clusterAssistCopy(on: boolean): { readonly chip: string; readonly title: string; readonly hint: string } {
  return on
    ? {
      chip: "보조",
      hint: "짝 타일 자동",
      title:
        "구조 보조 켜짐 — 나무·벤치·문처럼 규칙이 짝을 요구하는 타일은 동반 칸까지 한 번에 배치합니다."
        + " 놓을 수 없으면 그 자리에서 「이 칸만 정확히 배치」를 제안합니다. 누르면 정확 배치로 바뀝니다.",
    }
    : {
      chip: "정확",
      hint: "고른 칸만",
      title:
        "정확 배치 켜짐 — 고른 칸·레이어 하나만 바꿉니다. 동반 타일을 만들지 않으므로 규칙 위반은"
        + " 검사 목록에 규칙·좌표와 함께 남습니다. 보호셀과 다른 덧그림 오브젝트는 그래도 덮지 않습니다."
        + " 누르면 구조 보조로 돌아갑니다.",
    };
}

/** 구조 보조 토글 — 이웃 연결과 별개 상태다. */
export function toggleClusterAssistMode(): boolean {
  const next = !editorState.get().clusterAssistMode;
  editorState.set({ clusterAssistMode: next });
  return next;
}
