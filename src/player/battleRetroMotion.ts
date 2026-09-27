import { CAST_TYPES, EXTENDED_POSE_FRAME, castTypeForSkill, type CastType, type ExtendedBattlerPose } from "@/battle/battlePose";
import type { PixelEnemyCell } from "@/assets/pixelEnemySheets";
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
  // 도트 적 시트는 칸을 retroPixelEnemyCell 이 고른다. 의미 포즈만 그대로 통과시킨다.
  if (node.dataset.pixelEnemy) return node.classList.contains("defeated") || pose === "dead" ? "dead" : "idle";
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

/**
 * 지금 그릴 칸이 시전 칸(cast_charge/raise/release, skill 제외)이고 이 행동에 마법 종류가 붙어 있으면
 * 시전 시트의 (종류, 단계)를 돌려준다. 준비=1, 영창=2, 방출=3. 표시 계층(applyBattlerPose)이 시전 시트로 그린다.
 */
export function retroCastFrameFor(node: HTMLElement, pose: Pose): { readonly type: CastType; readonly step: 1 | 2 | 3 } | undefined {
  const type = node.dataset.retroCast as CastType | undefined;
  if (!type || !CAST_TYPES.includes(type) || !node.dataset.retroBeat) return undefined;
  const step = pose === "cast_charge" ? 1 : pose === "cast_raise" ? 2 : pose === "cast_release" ? 3 : undefined;
  return step ? { type, step } : undefined;
}

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
      delete node.dataset.retroReach;
      if (node.dataset.pixelEnemy) resetPixelEnemy(node);
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
          // 공격력으로 치는 기술(검격 등)은 걸어가서 벤다. 나머지 기술은 제자리 시전.
          : entry && entry.commandKind === "skill" && isMeleeEntry(entry) ? "attack"
            : entry?.commandKind === "skill" || entry?.commandKind === "item" ? "cast" : "attack";
    // 마법 종류별 시전 칸(cast 시트). 걷기 칩 시트가 아니면 기존 시전 칸으로 떨어진다.
    const castType = user.dataset.retroAction === "cast" && skill ? castTypeForSkill(skill) : undefined;
    if (castType) user.dataset.retroCast = castType;
    else delete user.dataset.retroCast;
    // 차례의 반 걸음 위치에서 출발한다. 화면 배율을 이동 거리에 다시 곱하지 않는다.
    user.style.setProperty("--retro-start", user.dataset.retroCommand === "true" ? "-16px" : "0px");
    // 근접 공격은 대상 적 앞까지 실제로 걸어간다(retroWalk 가 DOM 좌표로 잰다). 못 재면 72px.
    const walk = entry && user.dataset.retroAction === "attack" && user.classList.contains("battle-actor") ? retroWalk(field, entry) : undefined;
    user.style.setProperty("--retro-travel", user.dataset.retroAction === "defend" ? "0px"
      : ["cast", "item"].includes(user.dataset.retroAction) ? "-16px"
        : `${-(walk?.distance ?? 72)}px`);
    if (user.dataset.pixelEnemy && entry) {
      // 도트 적: 근접 공격은 대상 아군 앞까지 뛰어/날아간다. 그 밖의 기술은 제자리에서 반 걸음만 나선다.
      const reach = retroEnemyReach(field, entry);
      user.dataset.retroReach = reach ? "melee" : "ranged";
      user.style.setProperty("--retro-enemy-dx", `${reach?.dx ?? 18}px`);
      user.style.setProperty("--retro-enemy-dy", `${reach?.dy ?? 0}px`);
    }
  }
  user.dataset.retroBeat = beat.kind;
  user.style.setProperty("--retro-beat-ms", `${Math.max(1, beat.durationMs)}ms`);
  if (user.dataset.battlerExtended === "true") animateExtendedBeat(user, beat);
  else if (user.dataset.pixelEnemy) animatePixelEnemyBeat(user, beat);
  else paint(user, "idle");
}

export function retroDamage(node: HTMLElement | null, feedback: DamageFeedback, lethal: boolean): void {
  if (!node) return;
  if (node.dataset.pixelEnemy) {
    if (feedback.healing || feedback.miss || feedback.amount <= 0) return;
    // 맞은 칸을 잠깐 보이고, 막타면 그 뒤 녹아내린 칸(dead)으로 넘어간다.
    if (lethal) node.classList.add("defeated");
    transientPose(node, "hit", lethal ? 200 : 380);
    return;
  }
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
    // 걸어가는 동안 걷기 칸을 돌리고, 적 앞에 도착한 마지막 구간(약 240ms)에 젖힘 → 휘두름. 착탄(impact)에서 attack 칸.
    // impact 비트는 히트스톱 길이(약 110ms)뿐이라 휘두름을 거기 다 넣으면 세 칸이 안 보였다.
    const walk: Pose[] = ["walk_a", "walk_b", "walk_c", "walk_b"];
    const swingMs = Math.min(240, length * 0.4);
    const walkMs = Math.max(0, length - swingMs);
    const steps = Math.max(1, Math.ceil(walkMs / 110));
    frames = [
      ...Array.from({ length: steps }, (_, i): [number, Pose] => [(i * walkMs / steps) / Math.max(1, length), walk[i % 4]!]),
      [walkMs / Math.max(1, length), "attack_windup"],
      [(walkMs + swingMs * 0.55) / Math.max(1, length), "attack_strike"],
    ];
  } else if (beat.kind === "impact") frames = [[0, "attack"]];
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

// ── 걸어가서 때리기 ─────────────────────────────────────────────────────────────────────
// 근접 공격(통상 공격·attack 계열 스킬)은 approach 비트 동안 대상 적 **바로 앞**까지 걷는다.
// 거리는 실제 DOM 좌표에서 잰다: 아군 몸 앞(왼쪽) 가장자리 → 적 그림 오른쪽 가장자리 + 여유.
// 시퀀서가 비트 길이를 정하기 전에(actorApproachMs) 한 번, 전진을 걸 때 한 번 부르므로 엔트리별로 기억한다.
const WALK_PX_PER_MS = 0.26;
const RETURN_PX_PER_MS = 0.36;
const WALK_GAP_PX = 6;
const walkCache = new WeakMap<HTMLElement, Map<number, RetroWalk | null>>();

export interface RetroWalk {
  /** 걸어가는 거리(무대 논리 px, 왼쪽이 양수). */
  readonly distance: number;
  readonly approachMs: number;
  readonly recoverMs: number;
}

/** 이 엔트리가 걸어가서 때리는 행동인가 — 아군의 통상 공격, 또는 공격력으로 치는 피해 스킬. */
function isMeleeEntry(entry: BattleTimelineEntrySnapshot): boolean {
  if (entry.side === "enemy") return false;
  if (entry.commandKind === "attack") return true;
  if (entry.commandKind !== "skill") return false;
  const skill = store.getCurrent().database.skills.find((row) => row.name === entry.skillName);
  return skill?.effect.kind === "damage" && skill.effect.statistic === "attack";
}

export function retroWalk(field: HTMLElement, entry: BattleTimelineEntrySnapshot): RetroWalk | undefined {
  let cache = walkCache.get(field);
  if (!cache) walkCache.set(field, cache = new Map());
  if (cache.has(entry.sequence)) return cache.get(entry.sequence) ?? undefined;
  const result = measureWalk(field, entry);
  cache.set(entry.sequence, result ?? null);
  return result;
}

function measureWalk(field: HTMLElement, entry: BattleTimelineEntrySnapshot): RetroWalk | undefined {
  if (!isMeleeEntry(entry) || reduced()) return undefined;
  const userId = entry.userRecordId ?? entry.userId;
  const user = [...field.querySelectorAll<HTMLElement>(".battle-actor")].find((node) => node.dataset.recordId === userId);
  const enemies = [...field.querySelectorAll<HTMLElement>(".battle-enemy:not(.defeated)")];
  const target = enemies.find((node) => node.dataset.testid === entry.targetId || node.dataset.recordId === entry.targetId) ?? enemies[0];
  if (!user || !target) return undefined;
  const userRect = user.getBoundingClientRect();
  // 화면 px → 배틀러 translate 단위. 무대 배율(--battle-stage-scale) 위에 필드 zoom 이 한 번 더 걸려 있어
  // 변수 하나로는 모자란다(실측: 걸음이 1.6배 넘쳐 화면 밖으로 나갔다). 노드 자신의 레이아웃 폭 대비 화면 폭으로 잰다.
  const scale = user.offsetWidth > 0 ? userRect.width / user.offsetWidth : 1;
  const image = target.querySelector<HTMLElement>(".battle-enemy-image") ?? target;
  const enemyRect = image.getBoundingClientRect();
  if (userRect.width === 0 || enemyRect.width === 0) return undefined;
  // 지금 걸린 translate(명령 차례의 반 걸음)는 빼고 제자리 기준으로 잰다.
  const current = Number.parseFloat(getComputedStyle(user).translate.split(" ")[0] ?? "0") || 0;
  // 96px 셀 안에서 몸은 가운데 약 40px 이다 — 몸 앞 가장자리 = 셀 가운데 − 20px.
  const bodyFront = (userRect.left + userRect.width / 2) / scale - current - 20;
  // 몬스터 그림은 투명 여백이 가장자리에 있다(실측 오른쪽 약 15%).
  const enemyFront = (enemyRect.right - enemyRect.width * 0.15) / scale;
  const distance = Math.round(bodyFront - enemyFront - WALK_GAP_PX);
  if (!Number.isFinite(distance) || distance < 24) return undefined;
  const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
  return {
    distance,
    approachMs: clamp(distance / WALK_PX_PER_MS, 420, 1100),
    recoverMs: clamp(distance / RETURN_PX_PER_MS, 420, 900),
  };
}


// ── 도트 적 시트(pixelEnemySheets.ts) ────────────────────────────────────────────────────
// 슬라임은 통통 두 번 뛰어 박치기(hop), 박쥐는 날개를 치켜들었다 내리꽂아 문다(swoop).
// 근접(통상 공격·공격력 기술)은 대상 아군 앞까지 간다. 거리는 DOM 에서 재고, 시퀀서가 비트 길이를 여기에 맞춘다.
const pixelAnimations = new WeakMap<HTMLElement, Animation>();
const reachCache = new WeakMap<HTMLElement, Map<number, RetroEnemyReach | null>>();
const ENEMY_HOLD_MS = 260;

export interface RetroEnemyReach {
  /** 대상 앞까지의 이동량(무대 논리 px, 오른쪽·아래가 양수). */
  readonly dx: number;
  readonly dy: number;
  readonly approachMs: number;
  readonly recoverMs: number;
}

/** 지금 그릴 도트 적 칸. 격파 → 맞은 칸을 잠깐 보인 뒤 녹은 칸, 피격 → hit, 행동 중 → 비트가 고른 칸. */
export function retroPixelEnemyCell(node: HTMLElement): PixelEnemyCell | "idle" {
  const transient = node.dataset.retroTransient;
  if (node.classList.contains("defeated")) return transient === "hit" ? "hit" : "dead";
  if (transient === "hit") return "hit";
  const cell = node.dataset.retroBeat ? node.dataset.retroPixelCell : undefined;
  return (cell as PixelEnemyCell | undefined) ?? "idle";
}

function resetPixelEnemy(node: HTMLElement): void {
  pixelAnimations.get(node)?.cancel();
  pixelAnimations.delete(node);
  delete node.dataset.retroPixelCell;
}

function isEnemyMeleeEntry(entry: BattleTimelineEntrySnapshot): boolean {
  if (entry.side !== "enemy") return false;
  if (entry.commandKind === "enemyAttack") return true;
  if (entry.commandKind !== "enemySkill") return false;
  const skill = store.getCurrent().database.skills.find((row) => row.name === entry.skillName);
  return skill?.effect.kind === "damage" && skill.effect.statistic === "attack";
}

export function retroEnemyReach(field: HTMLElement, entry: BattleTimelineEntrySnapshot): RetroEnemyReach | undefined {
  let cache = reachCache.get(field);
  if (!cache) reachCache.set(field, cache = new Map());
  if (cache.has(entry.sequence)) return cache.get(entry.sequence) ?? undefined;
  const result = measureEnemyReach(field, entry);
  cache.set(entry.sequence, result ?? null);
  return result;
}

function measureEnemyReach(field: HTMLElement, entry: BattleTimelineEntrySnapshot): RetroEnemyReach | undefined {
  if (!isEnemyMeleeEntry(entry) || reduced()) return undefined;
  const user = [...field.querySelectorAll<HTMLElement>(".battle-enemy[data-pixel-enemy]:not(.defeated)")]
    .find((node) => node.dataset.recordId === entry.userRecordId || node.dataset.testid === entry.userId);
  const target = [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated)")]
    .find((node) => node.dataset.recordId === entry.targetId);
  const image = user?.querySelector<HTMLElement>(".battle-enemy-image");
  const sprite = target?.querySelector<HTMLElement>(".battle-actor-sprite, .battle-actor-image") ?? target;
  if (!user || !image || !sprite) return undefined;
  const imageRect = image.getBoundingClientRect();
  const actorRect = sprite.getBoundingClientRect();
  if (imageRect.width === 0 || actorRect.width === 0) return undefined;
  // 화면 px → 적 노드 translate 단위(무대 배율 × 필드 zoom). 이미지 자신의 레이아웃 폭 대비 화면 폭으로 잰다.
  const scale = image.offsetWidth > 0 ? imageRect.width / image.offsetWidth : 1;
  const swoop = user.dataset.pixelEnemy === "swoop";
  // 착탄 칸의 앞 가장자리(64px 셀의 x≈61) → 아군 몸 앞(96px 셀 가운데 − 20px) 2px 앞.
  const front = imageRect.left + imageRect.width * (61 / 64);
  const actorFront = actorRect.left + actorRect.width / 2 - actorRect.width * (20 / 96);
  const dx = Math.round((actorFront - front) / scale - 2);
  // 슬라임은 발(셀 y=60)을 아군 발(48px 셀 y=44)에, 박쥐는 머리(셀 y≈24)를 아군 얼굴 높이(y≈20)에 맞춘다.
  const dy = Math.round(swoop
    ? (actorRect.top + actorRect.height * (20 / 48) - (imageRect.top + imageRect.height * (24 / 64))) / scale
    : (actorRect.top + actorRect.height * (44 / 48) - (imageRect.top + imageRect.height * (60 / 64))) / scale);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx < 16) return undefined;
  const distance = Math.hypot(dx, dy);
  const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
  return {
    dx,
    dy,
    approachMs: ENEMY_HOLD_MS + clamp(distance / (swoop ? 0.42 : 0.3), 300, 900),
    recoverMs: clamp(160 + distance / 0.42, 420, 900),
  };
}

type PathPoint = readonly [offset: number, x: number, y: number, easing?: string];

function animatePixelEnemyBeat(node: HTMLElement, beat: BattleActionBeat): void {
  const generation = (beatGenerations.get(node) ?? 0) + 1;
  beatGenerations.set(node, generation);
  const length = Math.max(0, beat.durationMs);
  const swoop = node.dataset.pixelEnemy === "swoop";
  const melee = node.dataset.retroReach === "melee";
  const dx = Number.parseFloat(node.style.getPropertyValue("--retro-enemy-dx")) || 18;
  const dy = Number.parseFloat(node.style.getPropertyValue("--retro-enemy-dy")) || 0;
  let cells: readonly [number, PixelEnemyCell][];
  let path: readonly PathPoint[];
  if (melee && beat.kind === "approach") {
    const hold = Math.min(0.45, ENEMY_HOLD_MS / Math.max(1, length));
    const travel = 1 - hold;
    if (swoop) {
      // 날개를 치켜들며 살짝 뒤로 떠올랐다가(windup) 날개를 접고 대상에게 내리꽂는다(move).
      path = [[0, 0, 0, "ease-out"], [hold, -8, -12, "ease-in"], [hold + travel * 0.45, dx * 0.45, dy * 0.35 - 14, "ease-in"], [1, dx, dy]];
      cells = [[0, "windup"], [hold, "move"]];
    } else {
      // 웅크렸다가(windup) 두 번 통통 뛴다. 중간 착지에서 잠깐 퍼진다(recover 칸).
      const land = hold + travel * 0.5;
      path = [
        [0, 0, 0], [hold * 0.5, -4, 0], [hold, -4, 0, "ease-out"],
        [hold + travel * 0.25, dx * 0.25, dy * 0.25 - 18, "ease-in"], [land, dx * 0.5, dy * 0.5, "ease-out"],
        [land + travel * 0.25, dx * 0.75, dy * 0.75 - 22, "ease-in"], [1, dx, dy],
      ];
      cells = [[0, "windup"], [hold, "move"], [Math.max(hold, land - travel * 0.06), "recover"], [land + travel * 0.06, "move"]];
    }
  } else if (melee && beat.kind === "impact") {
    path = [[0, dx, dy], [0.4, dx + 5, dy + (swoop ? 2 : 0)], [1, dx + 2, dy + (swoop ? 1 : 0)]];
    cells = [[0, "attack"]];
  } else if (melee) {
    if (swoop) {
      // 날개를 크게 쳐 뒤로 떠오른 뒤 날갯짓하며 제자리로.
      path = [[0, dx + 2, dy + 1, "ease-out"], [0.3, dx * 0.75, dy - 16], [0.9, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.3, "idle_a"], [0.45, "idle_c"], [0.6, "idle_a"], [0.75, "idle_c"], [0.9, "idle_b"]];
    } else {
      path = [[0, dx + 2, dy], [0.22, dx, dy, "ease-out"], [0.6, dx * 0.45, dy * 0.45 - 24, "ease-in"], [0.92, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.22, "move"], [0.9, "recover"]];
    }
  } else if (beat.kind === "approach") {
    // 제자리 기술: 뒤로 몸을 당겨 힘을 모은다.
    path = [[0, 0, 0, "ease-out"], [0.6, -6, swoop ? -6 : 0], [1, -6, swoop ? -6 : 0]];
    cells = [[0, "windup"]];
  } else if (beat.kind === "impact") {
    path = [[0, -6, swoop ? -6 : 0, "ease-out"], [0.5, dx, 0], [1, dx, 0]];
    cells = [[0, "attack"]];
  } else {
    path = [[0, dx, 0, "ease-in-out"], [0.8, 0, 0], [1, 0, 0]];
    cells = [[0, "recover"], [0.55, swoop ? "idle_a" : "idle_b"]];
  }
  if (reduced() || length === 0) cells = [[0, cells[0]![1]]];
  pixelAnimations.get(node)?.cancel();
  pixelAnimations.delete(node);
  // 길이 0 비트(빗나간 착탄)도 도착 자리를 붙잡아야 한다 — 애니메이션을 걷으면 한 프레임 제자리로 튄다.
  if (!reduced() && typeof node.animate === "function") {
    const animation = node.animate(
      path.map(([offset, x, y, easing]) => ({ offset, translate: `${Math.round(x)}px ${Math.round(y)}px`, ...(easing ? { easing } : {}) })),
      { duration: Math.max(1, length), fill: "forwards" },
    );
    pixelAnimations.set(node, animation);
  }
  for (const [fraction, cell] of cells) {
    const draw = () => {
      if (beatGenerations.get(node) !== generation || node.dataset.retroBeat !== beat.kind) return;
      node.dataset.retroPixelCell = cell;
      paint(node, "idle");
    };
    if (fraction === 0) draw();
    else scheduleBattleTimer(() => { if (node.isConnected) draw(); }, Math.min(length - 1, Math.round(length * fraction)));
  }
}
