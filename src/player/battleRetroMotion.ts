import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import type { DamageFeedback } from "@/player/battleSequencer";
import { scheduleBattleTimer } from "@/player/battleTimerScope";

type Pose = BattleBattlerSnapshot["pose"];
type PaintPose = (node: HTMLElement, pose: Pose) => void;
const painters = new WeakMap<HTMLElement, PaintPose>();
const cursors = new WeakMap<HTMLElement, number>();
const hitGenerations = new WeakMap<HTMLElement, number>();
const visualKinds = new Set(["action", "damage", "healing", "miss", "capture", "stateUpkeep", "stateRecovery"]);
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 포즈 원장과 별개인 짧은 연출 포즈. 기존 시트/idle 스트립 처리기를 그대로 통과한다. */
export function retroMotionPose(node: HTMLElement, pose: Pose, paint: PaintPose): Pose {
  painters.set(node, paint);
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
    const entry = snapshot.timeline.find((item) => item.sequence > (cursors.get(field) ?? -1)
      && visualKinds.has(item.kind) && (item.userRecordId === beat.userId || item.userId === beat.userId));
    if (entry) cursors.set(field, entry.sequence);
    user.dataset.retroAction = user.classList.contains("battle-enemy") ? "enemy"
      : entry?.commandKind === "defend" ? "defend"
        : entry?.commandKind === "skill" || entry?.commandKind === "item" ? "cast" : "attack";
    // 차례의 반 걸음 위치에서 출발한다. 화면 배율을 이동 거리에 다시 곱하지 않는다.
    user.style.setProperty("--retro-start", user.dataset.retroCommand === "true" ? "-16px" : "0px");
    user.style.setProperty("--retro-travel", user.dataset.retroAction === "defend" ? "0px" : user.dataset.retroAction === "cast" ? "-16px" : "-72px");
  }
  user.dataset.retroBeat = beat.kind;
  user.style.setProperty("--retro-beat-ms", `${Math.max(1, beat.durationMs)}ms`);
  paint(user, "idle");
}

export function retroDamage(node: HTMLElement | null, feedback: DamageFeedback, lethal: boolean): void {
  if (!node || feedback.healing || feedback.miss || feedback.amount <= 0) return;
  if (lethal && node.classList.contains("battle-enemy")) {
    // 원장의 syncEnemyNode가 기본 파편을 생성하기 전에 격파 상태를 예약한다.
    node.classList.add("defeated");
    return;
  }
  if (!node.classList.contains("battle-actor")) return;
  hitGenerations.set(node, (hitGenerations.get(node) ?? 0) + 1);
  node.dataset.retroHurt = "true";
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
    if (node.isConnected) paint(node, node.classList.contains("defeated") ? "dead" : "idle");
  }, 220);
}

export function retroVictory(field: HTMLElement): void {
  for (const node of field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated)")) {
    if (node.dataset.retroVictory) continue;
    node.dataset.retroVictory = "true";
    paint(node, "victory");
  }
}
