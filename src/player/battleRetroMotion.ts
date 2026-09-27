import { EXTENDED_POSE_FRAME, type ExtendedBattlerPose } from "@/battle/battlePose";
import { store } from "@/project/store";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { BattleSnapshot } from "@/battle/runtime";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import type { DamageFeedback } from "@/player/battleSequencer";
import { scheduleBattleTimer } from "@/player/battleTimerScope";

type Pose = ExtendedBattlerPose;
type PaintPose = (node: HTMLElement, pose: Pose) => void;
const painters = new WeakMap<HTMLElement, PaintPose>();
const cursors = new WeakMap<HTMLElement, number>();
const currentEntries = new WeakMap<HTMLElement, BattleTimelineEntrySnapshot>();
const hitGenerations = new WeakMap<HTMLElement, number>();
const visualKinds = new Set(["action", "damage", "healing", "miss", "capture", "stateUpkeep", "stateRecovery"]);
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 포즈 원장과 별개인 짧은 연출 포즈. 기존 시트/idle 스트립 처리기를 그대로 통과한다. */
export function retroMotionPose(node: HTMLElement, pose: Pose, paint: PaintPose): Pose {
  painters.set(node, paint);
  if (node.dataset.battlerExtended === "true") return extendedMotionPose(node, pose);
  if (pose === "dead") {
    if (!node.dataset.retroKo && node.classList.contains("battle-actor")) {
      node.dataset.retroKo = reduced() ? "settled" : "stagger";
      scheduleBattleTimer(() => {
        if (!node.isConnected || !node.classList.contains("defeated")) return;
        node.dataset.retroKo = "settled";
        paint(node, "dead");
      }, 160);
    }
    return node.dataset.retroKo === "stagger" ? "hit" : "dead";
  }
  delete node.dataset.retroKo;
  if (node.dataset.retroVictory === "true") return "victory";
  if (node.dataset.retroHurt === "true") return "hit";
  if (node.dataset.retroBeat) {
    if (node.dataset.retroAction === "cast" || node.dataset.retroAction === "defend") return "defend";
    return node.dataset.retroBeat === "impact" ? "attack" : "idle";
  }
  return pose;
}

function paint(node: HTMLElement, pose: Pose): void { painters.get(node)?.(node, pose); }

/** 시퀀서가 실제로 소비하는 시각 엔트리만 따라간다. 마지막 결과는 이미 다음 행동일 수 있다. */
export function initRetroMotion(field: HTMLElement, snapshot: BattleSnapshot): void {
  cursors.set(field, snapshot.timeline.at(-1)?.sequence ?? -1);
}

export function retroActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined, snapshot: BattleSnapshot): void {
  const nodes = [...field.querySelectorAll<HTMLElement>(".battle-actor, .battle-enemy")];
  const matchesUser = (node: HTMLElement) => node.dataset.recordId === beat?.userId || node.dataset.testid === beat?.userId
    || snapshot.actors.some((actor) => actor.id === beat?.userId && actor.recordId === node.dataset.recordId);
  const user = nodes.find((node) => !node.classList.contains("defeated") && matchesUser(node)) ?? nodes.find(matchesUser);
  for (const node of nodes) {
    node.classList.remove("battle-motion-knockback", "battle-motion-target");
    if (node === user && beat) continue;
    if (node.dataset.retroBeat) {
      delete node.dataset.retroBeat;
      delete node.dataset.retroAction;
      beatGenerations.set(node, (beatGenerations.get(node) ?? 0) + 1);
      delete node.dataset.retroFrame;
      paint(node, node.classList.contains("defeated") ? "dead" : "idle");
    }
  }
  if (beat?.targetMotion === "knockback") {
    const target = nodes.find((node) => node.dataset.testid === beat.targetId || node.dataset.recordId === beat.targetId
      || snapshot.actors.some((actor) => actor.id === beat.targetId && actor.recordId === node.dataset.recordId));
    target?.classList.add("battle-motion-target", "battle-motion-knockback");
  }
  if (!beat || !user) return;
  if (beat.kind === "approach") {
    const entry = currentEntries.get(field) ?? snapshot.timeline.find((item) => item.sequence > (cursors.get(field) ?? -1)
      && visualKinds.has(item.kind) && (item.userRecordId === beat.userId || item.userId === beat.userId));
    if (entry) cursors.set(field, entry.sequence);
    const skill = entry?.commandKind === "skill"
      ? store.getCurrent().database.skills.find((row) => row.name === entry.skillName) : undefined;
    user.dataset.retroFinisher = String(Boolean(skill?.limitSkill || (skill?.power ?? 0) >= 100));
    user.dataset.retroAction = user.classList.contains("battle-enemy") ? "enemy"
      : entry?.commandKind === "defend" ? "defend"
        : entry?.commandKind === "item" && user.dataset.battlerExtended === "true" ? "item"
          : entry?.commandKind === "skill" || entry?.commandKind === "item" ? "cast" : "attack";
    // 차례의 반 걸음 위치에서 출발한다. 화면 배율을 이동 거리에 다시 곱하지 않는다.
    user.style.setProperty("--retro-start", user.dataset.retroCommand === "true" ? "16px" : "0px");
    user.style.setProperty("--retro-travel", user.dataset.retroAction === "defend" ? "0px" : ["cast", "item"].includes(user.dataset.retroAction) ? "16px" : "72px");
  }
  user.dataset.retroBeat = beat.kind;
  user.style.setProperty("--retro-beat-ms", `${Math.max(1, beat.durationMs)}ms`);
  if (user.dataset.battlerExtended === "true") animateExtendedBeat(user, beat);
  else paint(user, "idle");
}

export function retroDamage(node: HTMLElement | null, feedback: DamageFeedback, lethal: boolean): void {
  if (!node) return;
  if (node.dataset.battlerExtended === "true" && feedback.miss) {
    transientPose(node, "evade", 240);
    return;
  }
  if (node.dataset.battlerExtended === "true" && !feedback.healing && !feedback.miss && feedback.amount === 0) {
    // 막아낸 0 피해에는 히트스톱 종료 콜백이 없다. 짧은 방어 피격 칸만 자체 복귀한다.
    transientPose(node, node.dataset.battlerDefending === "true" ? "guard_hit" : "hit", 220);
    return;
  }
  if (feedback.healing || feedback.miss || feedback.amount <= 0) return;
  if (lethal && node.classList.contains("battle-enemy")) {
    // 원장의 syncEnemyNode가 기본 파편을 생성하기 전에 격파 상태를 예약한다.
    node.classList.add("defeated");
    return;
  }
  if (!node.classList.contains("battle-actor")) return;
  hitGenerations.set(node, (hitGenerations.get(node) ?? 0) + 1);
  node.dataset.retroHurt = "true";
  if (node.dataset.battlerExtended === "true") node.dataset.retroHurtFrame = node.dataset.battlerDefending === "true" ? "guard_hit" : "hit";
  paint(node, lethal ? "dead" : "hit");
}

/** 흰 히트스톱이 끝난 뒤 붉은 두 번 점멸. rAF를 기다리지 않는다. */
export function retroHitRelease(node: HTMLElement): void {
  if (!node.classList.contains("battle-actor")) return;
  node.classList.remove("retro-hit-release");
  void node.offsetWidth;
  node.classList.add("retro-hit-release");
  const generation = hitGenerations.get(node);
  scheduleBattleTimer(() => {
    if (hitGenerations.get(node) !== generation) return;
    node.classList.remove("retro-hit-release");
    delete node.dataset.retroHurt;
    delete node.dataset.retroHurtFrame;
    if (node.isConnected) paint(node, node.classList.contains("defeated") ? "dead" : "idle");
  }, 220);
}

export function retroVictory(field: HTMLElement): void {
  for (const node of field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated)")) {
    if (node.dataset.retroVictory) continue;
    node.dataset.retroVictory = "true";
    paint(node, "victory");
    if (node.dataset.battlerExtended === "true") victoryLoop(node);
  }
}


const beatGenerations = new WeakMap<HTMLElement, number>();
const transientGenerations = new WeakMap<HTMLElement, number>();

function extendedFrame(value: string | undefined): Pose | undefined {
  return value && Object.hasOwn(EXTENDED_POSE_FRAME, value) ? value as Pose : undefined;
}

/** 비트가 바뀌면 이전 비트의 콜백은 폐기한다. 장면 종료는 공용 타이머 스코프가 맡는다. */
function animateExtendedBeat(node: HTMLElement, beat: BattleActionBeat): void {
  const generation = (beatGenerations.get(node) ?? 0) + 1;
  beatGenerations.set(node, generation);
  const length = Math.max(0, beat.durationMs);
  const action = node.dataset.retroAction;
  const finisher = node.dataset.retroFinisher === "true";
  let frames: readonly [number, Pose][];
  if (action === "defend") frames = [[0, "defend"]];
  else if (action === "item") frames = [[0, "item"]];
  else if (action === "cast") {
    frames = beat.kind === "approach" ? [[0, "cast_charge"], [0.55, "cast_raise"]]
      : beat.kind === "impact" ? [[0, finisher ? "skill" : "cast_release"]]
        : [[0, finisher ? "skill" : "cast_release"], [0.6, "idle"]];
  } else if (beat.kind === "approach") {
    const walk: Pose[] = ["walk_a", "walk_b", "walk_c", "walk_b"];
    frames = Array.from({ length: Math.max(1, Math.ceil(length / 90)) }, (_, i) => [i * 90 / Math.max(1, length), walk[i % 4]]);
  } else if (beat.kind === "impact") frames = [[0, "attack_windup"], [0.3, "attack_strike"], [0.65, "attack"]];
  else frames = [[0, "attack_follow"], [0.18, "evade"], [0.86, "idle"]];
  // 감속 모드와 길이 0 비트에서는 대표 칸만 내보내고 뒤늦은 칸 전환을 예약하지 않는다.
  if (reduced() || length === 0) {
    frames = [[0, action === "defend" ? "defend" : action === "item" ? "item"
      : beat.kind === "recover" ? "idle" : action === "cast" ? (finisher ? "skill" : "cast_release")
        : beat.kind === "impact" ? "attack" : "idle"]];
  }
  for (const [fraction, frame] of frames) {
    const draw = () => {
      if (beatGenerations.get(node) !== generation || node.dataset.retroBeat !== beat.kind) return;
      node.dataset.retroFrame = frame;
      paint(node, "idle");
    };
    if (fraction === 0) draw();
    else scheduleBattleTimer(() => { if (node.isConnected) draw(); }, Math.min(length - 1, Math.round(length * fraction)));
  }
}

function transientPose(node: HTMLElement, frame: Pose, duration: number): void {
  const generation = (transientGenerations.get(node) ?? 0) + 1;
  transientGenerations.set(node, generation);
  node.dataset.retroTransient = frame;
  paint(node, "idle");
  scheduleBattleTimer(() => {
    if (transientGenerations.get(node) !== generation) return;
    delete node.dataset.retroTransient;
    if (node.isConnected) paint(node, "idle");
  }, duration);
}

function extendedMotionPose(node: HTMLElement, pose: Pose): Pose {
  if (pose === "dead" || node.classList.contains("defeated")) {
    if (!node.dataset.retroKo) {
      node.dataset.retroKo = reduced() ? "settled" : "stagger";
      delete node.dataset.retroTransient;
      delete node.dataset.retroHurt;
      scheduleBattleTimer(() => {
        if (!node.isConnected || !node.classList.contains("defeated")) return;
        node.dataset.retroKo = "settled";
        paint(node, "dead");
      }, 160);
    }
    return node.dataset.retroKo === "stagger" ? "dying" : "dead";
  }
  // 표시 원장이 생존으로 돌아오는 순간에만 부활을 시작한다. 미래 스냅샷에 앞서 일어나지 않는다.
  if (node.dataset.retroKo) {
    delete node.dataset.retroKo;
    delete node.dataset.retroHurt;
    transientPose(node, "revive", reduced() ? 120 : 260);
    return "revive";
  }
  if (node.dataset.retroVictory === "true") return extendedFrame(node.dataset.retroVictoryFrame) ?? "victory";
  if (node.dataset.retroHurt === "true") return extendedFrame(node.dataset.retroHurtFrame) ?? "hit";
  const transient = extendedFrame(node.dataset.retroTransient);
  if (transient) return transient;
  const frame = node.dataset.retroBeat ? extendedFrame(node.dataset.retroFrame) : undefined;
  if (frame && frame !== "idle") return frame;
  if (node.dataset.retroCommand === "true") return "idle";
  if (node.dataset.battlerDefending === "true") return "defend";
  if (node.dataset.battlerWeak === "true") return "weak";
  return pose === "victory" ? "victory" : "idle";
}

function victoryLoop(node: HTMLElement): void {
  node.dataset.retroVictoryFrame = "victory";
  if (reduced()) return;
  const next = () => {
    if (!node.isConnected || node.dataset.retroVictory !== "true" || node.classList.contains("defeated")) return;
    node.dataset.retroVictoryFrame = node.dataset.retroVictoryFrame === "victory" ? "victory_b" : "victory";
    paint(node, "victory");
    scheduleBattleTimer(next, 260);
  };
  scheduleBattleTimer(next, 260);
}


/** 명령 선택 직후에도 빈사 대기에서 준비 자세로 즉시 돌아간다. */
export function retroCommandPose(node: HTMLElement, active: boolean): void {
  const changed = node.dataset.retroCommand !== String(active);
  node.dataset.retroCommand = String(active);
  if (changed && node.dataset.battlerExtended === "true") paint(node, node.classList.contains("defeated") ? "dead" : "idle");
}


/** 시퀀서가 소비 중인 엔트리 자체를 쓴다. 같은 사용자의 과거 피해를 재검색하지 않는다. */
export function retroTimelineEntry(field: HTMLElement, entry: BattleTimelineEntrySnapshot): void {
  currentEntries.set(field, entry);
}
