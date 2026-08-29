// player/playBootRecovery.ts
// 플레이 부팅 실패를 «막다른 문구» 가 아니라 **기계가 읽은 실패 이유 + 실제로 눌리는 복구
// 행동**으로 바꾸는 얇은 권위. 편집기 프로젝트 로드 실패 화면(`src/app/mode.ts` 의
// `renderProjectLoadErrorScreen`)과 같은 모양을 따른다 — 원문 오류 메시지를 그대로 보여 주고,
// 그 옆에 실행 가능한 버튼을 둔다.
//
// 여기 있는 것은 모두 순수 계산 + store 능력 확인뿐이다. DOM 은 만들지 않는다(복구 패널의
// 정본은 `playLoadingOverlay.showRecovery` 하나다).

import type { PlayPreflightBlocker, PlayPreflightRepair } from "@/project/playPreflight";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type PlayBootFailureKind = "preflight-blocked" | "ready-timeout" | "boot-threw";

export type PlayBootFailureContext = {
  readonly kind: PlayBootFailureKind;
  /** 부팅이 던진 원문 오류(있으면 message 를 이유로 쓴다). */
  readonly error?: unknown;
  /** ready 대기가 돌려준 기계 사유 문자열(`timeout` / `stale-run` …). */
  readonly readyReason?: string;
  readonly blockers?: readonly PlayPreflightBlocker[];
  readonly mapId?: string;
  readonly elapsedMs?: number;
  /** 어느 단계에서 터졌는지 — 진단 복사용. */
  readonly detail?: string;
};

export type PlayBootFailureDescription = {
  readonly title: string;
  readonly reason: string;
  readonly diagnostics: string;
};

/** ready 대기 상한. `player.ts` 의 waitForPlaySceneReady 와 같은 값을 사람이 읽는 문장에 쓴다. */
const READY_TIMEOUT_LABEL = "30초";

export function describeBootFailure(context: PlayBootFailureContext): PlayBootFailureDescription {
  const reason = failureReason(context);
  return {
    title: failureTitle(context),
    reason,
    diagnostics: bootDiagnosticsText(context, reason),
  };
}

function failureTitle(context: PlayBootFailureContext): string {
  switch (context.kind) {
    case "preflight-blocked":
      return "이 프로젝트로는 플레이를 시작할 수 없습니다";
    case "ready-timeout":
      return "플레이 씬이 준비되지 않았습니다";
    case "boot-threw":
      return "플레이를 시작하지 못했습니다";
  }
}

/** 절대 «시작하지 못했습니다» 같은 맨문장으로 끝내지 않는다 — 기계가 본 값을 그대로 싣는다. */
function failureReason(context: PlayBootFailureContext): string {
  if (context.kind === "preflight-blocked") {
    const details = (context.blockers ?? []).map((blocker) => `${blocker.detail} (${blocker.code})`);
    return details.length > 0 ? details.join("\n") : "예비검사가 부팅을 막았습니다.";
  }
  if (context.kind === "ready-timeout") {
    const readyReason = context.readyReason ?? "unknown";
    return `PlayScene 준비 대기가 끝나지 않았습니다 — reason=${readyReason} (상한 ${READY_TIMEOUT_LABEL})`;
  }
  return bootErrorMessage(context.error);
}

export function bootErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message ? `${error.name}: ${message}` : error.name;
  }
  if (error === undefined || error === null) return "원인을 알 수 없는 오류(빈 예외)";
  const text = String(error).trim();
  return text || "원인을 알 수 없는 오류(빈 예외)";
}

/** «진단 내용 복사» 가 붙여 주는 본문. 기계 값만 담는다. */
function bootDiagnosticsText(context: PlayBootFailureContext, reason: string): string {
  const lines = [
    "[play-boot-recovery]",
    `kind=${context.kind}`,
    context.mapId ? `map=${context.mapId}` : undefined,
    context.detail ? `detail=${context.detail}` : undefined,
    context.elapsedMs === undefined ? undefined : `elapsedMs=${Math.round(context.elapsedMs)}`,
    reason,
    context.error instanceof Error && context.error.stack ? context.error.stack : undefined,
  ];
  return lines.filter((line): line is string => line !== undefined).join("\n");
}

/** 복구 패널의 «자동으로 복구한 항목» 목록. 코드까지 남겨 보고에 쓸 수 있게 한다. */
export function repairSummaries(repairs: readonly PlayPreflightRepair[]): readonly string[] {
  return repairs.map((repair) => `${repair.detail} (${repair.code})`);
}

/**
 * 예비검사로 고친 프로젝트를 **런타임이 실제로 읽는 자리**에 올린다. PlayScene 은 언제나
 * `store.getCurrent()` 에서 프로젝트를 읽으므로 이 통로 말고는 고친 프로젝트를 넘길 방법이 없다.
 *
 * 내보낸 플레이어의 읽기 전용 대역(exportProjectStoreShim)도 같은 스냅숏 기능을 제공한다.
 * 세션 생성은 이 스냅숏과 별개로 고친 프로젝트를 명시적으로 받아 시작 맵/좌표를 복구한다.
 */
export function installBootProject(project: Project): () => void {
  const host = store as { beginReadOnlyProjectSnapshot?: (snapshot: Project) => () => void };
  if (typeof host.beginReadOnlyProjectSnapshot !== "function") return () => undefined;
  return host.beginReadOnlyProjectSnapshot(project);
}

/**
 * 안전 모드 프로젝트: 저작된 자율 이동과 자동/병렬 실행을 걷어낸다. 목적은 «저작 내용의
 * 버그가 작업자가 맵을 들여다보는 것 자체를 막지 못하게» 하는 것이다 — 무한 루프 자동 이벤트,
 * 벽을 파고드는 추적 NPC, 매 틱 도는 병렬 프로세스가 대표적인 부팅 방해 원인이다.
 * 조사(action) 이벤트는 남긴다: 작업자가 스스로 눌러 보는 것은 막을 이유가 없다.
 */
export function safeModeProject(project: Project): Project {
  const draft = structuredClone(project);
  for (const map of Object.values(draft.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (event.trigger?.kind === "auto" || event.trigger?.kind === "parallel") {
        event.trigger = { kind: "action" };
      }
      delete event.moveRoute;
      delete event.schedule;
      for (const page of event.pages ?? []) {
        if (page.trigger?.kind === "auto" || page.trigger?.kind === "parallel") {
          page.trigger = { kind: "action" };
        }
        if (!page.movement) continue;
        page.movement = { ...page.movement, type: "fixed" };
        delete page.movement.route;
        delete page.movement.living;
      }
    }
  }
  for (const commonEvent of draft.commonEvents ?? []) {
    if (commonEvent.trigger === "auto" || commonEvent.trigger === "parallel") {
      commonEvent.trigger = "none";
    }
  }
  return draft;
}
