import { animateRetroSkillFx, clearRetroSkillFx, driveRetroClassSkill, isRetroClassSkillActor, preloadRetroClassSkillFx, preloadRetroSkillFx, retroSkillForEntry, setRetroSkillEntry, type RetroSkillRecipe } from "@/player/retroSkillChoreography";
import { CAST_TYPES, EXTENDED_POSE_FRAME, castTypeForSkill, type CastType, type ExtendedBattlerPose } from "@/battle/battlePose";
import type { PixelEnemyCell } from "@/assets/pixelEnemySheets";
import { store } from "@/project/store";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { BattleSnapshot } from "@/battle/runtime";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import type { DamageFeedback } from "@/player/battleSequencer";
import { scheduleBattleTimer } from "@/player/battleTimerScope";
import { playBattleSample, preloadBattleSamples } from "@/player/battleSeSamples";

type Pose = ExtendedBattlerPose;
type PaintPose = (node: HTMLElement, pose: Pose) => void;
const actorRecipes = new WeakMap<HTMLElement, RetroSkillRecipe>();
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

/** 표시 계층이 이미 한 번 그린 배틀러를 현재 연출 상태로 다시 그린다. */
export function repaintRetroBattler(node: HTMLElement): void { paint(node, "idle"); }

/**
 * 지금 그릴 칸이 시전 칸(cast_charge/raise/release, skill 제외)이고 이 행동에 마법 종류가 붙어 있으면
 * 시전 시트의 (종류, 단계)를 돌려준다. 준비=1, 영창=2, 방출=3. 표시 계층(applyBattlerPose)이 시전 시트로 그린다.
 */
export function retroCastFrameFor(node: HTMLElement, pose: Pose): { readonly type: CastType; readonly step: 1 | 2 | 3 } | undefined {
  const type = node.dataset.retroCast as CastType | undefined;
  if (!type || !CAST_TYPES.includes(type) || !(node.dataset.retroBeat || node.dataset.retroClassSkill)) return undefined;
  const step = pose === "cast_charge" ? 1 : pose === "cast_raise" ? 2 : pose === "cast_release" ? 3 : undefined;
  return step ? { type, step } : undefined;
}

/** 시퀀서가 실제로 소비하는 시각 엔트리만 따라간다. 마지막 결과는 이미 다음 행동일 수 있다. */
export function initRetroMotion(field: HTMLElement, snapshot: BattleSnapshot): void {
  cursors.set(field, snapshot.timeline.at(-1)?.sequence ?? -1);
  preloadRetroSkillFx();
  preloadRetroClassSkillFx();
}

export function retroActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined, snapshot: BattleSnapshot): void {
  if (!beat) clearRetroSkillFx(field);
  const nodes = [...field.querySelectorAll<HTMLElement>(".battle-actor, .battle-enemy")];
  const matchesUser = (node: HTMLElement) => node.dataset.recordId === beat?.userId || node.dataset.testid === beat?.userId
    || snapshot.actors.some((actor) => actor.id === beat?.userId && actor.recordId === node.dataset.recordId);
  const user = nodes.find((node) => !node.classList.contains("defeated") && matchesUser(node)) ?? nodes.find(matchesUser);
  for (const node of nodes) {
    node.classList.remove("battle-motion-knockback", "battle-motion-target");
    if (node === user && beat) continue;
    // 직업 스킬 재생기가 움직이는 배우는 재생기가 끝낼 때까지 그대로 둔다(전체기의 엔트리 사이 정리가 연출을 끊었다).
    if (isRetroClassSkillActor(node)) continue;
    if (node.dataset.retroBeat) {
      delete node.dataset.retroBeat;
      delete node.dataset.retroAction;
      delete node.dataset.retroSkill;
      actorRecipes.delete(node);
      delete node.dataset.retroReach;
      delete node.dataset.retroStyle;
      approachAnimations.get(node)?.cancel();
      approachAnimations.delete(node);
      if (node.dataset.pixelEnemy) resetPixelEnemy(node);
      beatGenerations.set(node, (beatGenerations.get(node) ?? 0) + 1);
      delete node.dataset.retroFrame;
      paint(node, node.classList.contains("defeated") ? "dead" : "idle");
    }
  }
  if (beat?.targetMotion === "knockback") {
    // 전투 id(enemy-2 등)가 먼저다 — 같은 종족 둘이면 recordId 로는 첫째가 맞은 것처럼 보였다.
    const target = nodes.find((node) => node.dataset.testid === beat.targetId)
      ?? nodes.find((node) => node.dataset.recordId === beat.targetId
        || snapshot.actors.some((actor) => actor.id === beat.targetId && actor.recordId === node.dataset.recordId));
    target?.classList.add("battle-motion-target", "battle-motion-knockback");
  }
  if (!beat || !user) return;
  // 직업 스킬 96종(계약 retroClassSkills)과 몬스터 스킬 42종(계약 retroMonsterSkills): 타임라인 재생기가
  // 포즈·이동·이펙트를 모두 소유한다. 몬스터는 도트 시트 칸(retroPixelCell)을 재생기가 고른다.
  {
    const entry = currentEntries.get(field);
    if (beat.kind === "approach" && entry) cursors.set(field, entry.sequence);
    if (driveRetroClassSkill(field, user, beat, entry, snapshot.timeline, (node) => paint(node, "idle"))) {
      user.dataset.retroBeat = beat.kind;
      user.dataset.retroAction = "skill";
      user.style.setProperty("--retro-beat-ms", `${Math.max(1, beat.durationMs)}ms`);
      return;
    }
  }
  if (beat.kind === "approach") {
    const entry = currentEntries.get(field) ?? snapshot.timeline.find((item) => item.sequence > (cursors.get(field) ?? -1)
      && visualKinds.has(item.kind) && (item.userRecordId === beat.userId || item.userId === beat.userId));
    if (entry) cursors.set(field, entry.sequence);
    const skill = entry?.commandKind === "skill"
      ? store.getCurrent().database.skills.find((row) => row.name === entry.skillName) : undefined;
    const recipe = user.classList.contains("battle-actor") ? retroSkillForEntry(entry) : undefined;
    if (recipe) { actorRecipes.set(user, recipe); user.dataset.retroSkill = recipe.fx; }
    else { actorRecipes.delete(user); delete user.dataset.retroSkill; }
    user.dataset.retroFinisher = String(Boolean(skill?.limitSkill || (skill?.power ?? 0) >= 100));
    user.dataset.retroAction = user.classList.contains("battle-enemy") ? "enemy"
      : entry?.commandKind === "defend" ? "defend"
        : entry?.commandKind === "item" && user.dataset.battlerExtended === "true" ? "item"
          // 공격력으로 치는 기술(검격 등)은 걸어가서 벤다. 나머지 기술은 제자리 시전.
          : recipe ? (recipe.approach === "still" ? "cast" : "attack")
          : entry && entry.commandKind === "skill" && isMeleeEntry(entry) ? "attack"
            : entry?.commandKind === "skill" || entry?.commandKind === "item" ? "cast" : "attack";
    // 마법 종류별 시전 칸(cast 시트). 걷기 칩 시트가 아니면 기존 시전 칸으로 떨어진다.
    const castType = recipe?.cast ?? (user.dataset.retroAction === "cast" && skill ? castTypeForSkill(skill) : undefined);
    if (castType) user.dataset.retroCast = castType;
    else delete user.dataset.retroCast;
    // 이 스킨은 날아가는 투사체 애니메이션을 띄우지 않는다(battleDom). 그 소리도 함께 빠지므로 표시해 두고 방출음을 낸다.
    user.dataset.retroMuted = String(isTravellingEffect(entry?.animation));
    // 차례의 반 걸음 위치에서 출발한다. 화면 배율을 이동 거리에 다시 곱하지 않는다.
    user.style.setProperty("--retro-start", user.dataset.retroCommand === "true" ? "-16px" : "0px");
    // 근접 공격은 대상 적 앞까지 실제로 걸어간다(retroWalk 가 DOM 좌표로 잰다). 못 재면 72px.
    // 가로만 가면 뒷줄 적을 공중에서 친다 — 대상의 발 높이까지 세로로도 간다(--retro-travel-y).
    const walk = entry && user.dataset.retroAction === "attack" && user.classList.contains("battle-actor") ? retroWalk(field, entry) : undefined;
    user.style.setProperty("--retro-travel-y", `${walk?.dy ?? 0}px`);
    user.style.setProperty("--retro-travel", user.dataset.retroAction === "defend" ? "0px"
      : ["cast", "item"].includes(user.dataset.retroAction) ? "-16px"
        : `${-(walk?.distance ?? 72)}px`);
    // 근접은 직업별 접근(질주·도약·순간이동·섬광). 거리를 못 쟀으면(감속 모드 등) 예전 걷기 키프레임.
    if (walk) user.dataset.retroStyle = recipe && recipe.approach !== "still" ? recipe.approach : retroApproachStyle(entry?.userRecordId ?? user.dataset.recordId);
    else delete user.dataset.retroStyle;
    if (user.dataset.pixelEnemy && entry) {
      // 도트 적: 근접 공격은 대상 아군 앞까지 뛰어/날아간다. 그 밖의 기술은 제자리에서 반 걸음만 나선다.
      const reach = retroEnemyReach(field, entry);
      user.dataset.retroReach = reach ? "melee" : "ranged";
      user.style.setProperty("--retro-enemy-dx", `${reach?.dx ?? 18}px`);
      user.style.setProperty("--retro-enemy-dy", `${reach?.dy ?? 0}px`);
    }
  }
  animateRetroSkillFx(field, user, beat);
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
  // 접근 경로(Web Animations, fill forwards)는 CSS 키프레임보다 위에 쌓인다 — 착탄부터는 CSS(retro-thrust/return)에 넘긴다.
  if (beat.kind !== "approach") {
    approachAnimations.get(node)?.cancel();
    approachAnimations.delete(node);
  }
  if (beat.kind === "recover" && node.dataset.retroStyle === "blink" && !reduced() && length > 0 && typeof node.animate === "function") {
    // 순간이동으로 온 캐릭터는 돌아갈 때도 빛나며 사라졌다 제자리에 나타난다.
    scheduleBattleTimer(() => { if (node.isConnected) motionSe("blink", 0.26); }, Math.round(length * 0.3));
    const dx = node.style.getPropertyValue("--retro-travel") || "0px";
    const dy = node.style.getPropertyValue("--retro-travel-y") || "0px";
    approachAnimations.set(node, node.animate([
      { offset: 0, translate: `${dx} ${dy}`, opacity: 1, filter: "none" },
      { offset: 0.3, translate: `${dx} ${dy}`, opacity: 1, filter: "brightness(2.4)" },
      { offset: 0.42, translate: `${dx} ${dy}`, opacity: 0, filter: "brightness(3)", easing: "steps(1, end)" },
      { offset: 0.62, translate: "0px 0px", opacity: 0, filter: "brightness(3)" },
      { offset: 0.8, translate: "0px 0px", opacity: 1, filter: "brightness(1.6)" },
      { offset: 1, translate: "0px 0px", opacity: 1, filter: "none" },
    ], { duration: length, fill: "forwards" }));
  }
  const recipe = actorRecipes.get(node);
  let frames: readonly (readonly [number, Pose])[];
  if (recipe) {
    if (beat.kind === "approach" && recipe.approach !== "still" && !reduced() && length > 0 && typeof node.animate === "function") {
      // Arrive in the first third; the remaining beat belongs to the actual combo.
      animateMeleeApproach(node, length * 0.34);
    }
    frames = beat.kind === "approach" ? recipe.poses
      : beat.kind === "impact" ? [[0, recipe.release]]
        : [[0, recipe.release], [recipe.approach === "still" ? 0.72 : 0.2, "idle"]];
  }
  else if (action === "defend") frames = [[0, "defend"]];
  else if (action === "item") frames = [[0, "item"]];
  else if (action === "cast") {
    frames = beat.kind === "approach" ? [[0, "cast_charge"], [0.55, "cast_raise"]]
      : beat.kind === "impact" ? [[0, finisher ? "skill" : "cast_release"]]
        : [[0, finisher ? "skill" : "cast_release"], [0.6, "idle"]];
    // 방출 소리는 투사체가 빠진 기술에만 — 자기 애니메이션이 화면에 뜨는 기술은 그 소리가 이미 운다.
    const cast = node.dataset.retroCast as CastType | undefined;
    if (beat.kind === "approach" && cast && node.dataset.retroMuted === "true") {
      scheduleBattleTimer(() => {
        if (node.isConnected && beatGenerations.get(node) === generation) motionSe(`cast-${cast}` as MotionCue, 0.3);
      }, Math.max(0, length - 60));
    }
  } else if (beat.kind === "approach") {
    if (node.dataset.retroStyle && !reduced() && length > 0 && typeof node.animate === "function") {
      frames = animateMeleeApproach(node, length);
    } else {
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
    }
  } else if (beat.kind === "impact") frames = [[0, "attack"]];
  else frames = [[0, "attack_follow"], [0.18, "evade"], [0.86, "idle"]];
  // 감속 모드와 길이 0 비트에서는 대표 칸만 내보내고 뒤늦은 칸 전환을 예약하지 않는다.
  if (reduced() || length === 0) {
    frames = [[0, recipe ? (beat.kind === "recover" ? "idle" : recipe.release) : action === "defend" ? "defend" : action === "item" ? "item"
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
  // 직업 스킬 재생기는 비트 밖(훔치기의 special 엔트리, 전체기의 엔트리 사이)에서도 칸을 소유한다.
  const frame = node.dataset.retroBeat || node.dataset.retroClassSkill ? extendedFrame(node.dataset.retroFrame) : undefined;
  if (frame && frame !== "idle") return frame;
  if (node.dataset.retroCommand === "true") return "idle";
  if (node.dataset.battlerDefending === "true") return "defend";
  // 빈사 대기(weak) 칸은 쓰지 않는다 — HP 가 낮다는 정보는 HP 줄이 준다. 전투 내내 앉아 있는 것처럼 보였다.
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
  setRetroSkillEntry(field, entry);
}

// ── 도트 측면 접근 효과음 ────────────────────────────────────────────────────────────────
// 이동 사건 1개에 소리 1개(battleJuice 의 계약과 같다). 휘두름·타격음은 기존 경로(attack-swing·hit-*)가 그대로 낸다.
// 샘플은 EasyRPG RTP(CC-BY, 게임과 함께 출하). 디코드 캐시가 비었으면 이번 한 번은 조용히 넘어간다(다음부터 즉시).
const MOTION_SE = {
  dash: "easyrpg-sound-wind8",
  leap: "easyrpg-sound-move",
  land: "easyrpg-sound-earth2",
  blink: "easyrpg-sound-teleport2",
  flash: "easyrpg-sound-flash1",
  "enemy-hop": "easyrpg-sound-move",
  "enemy-swoop": "easyrpg-sound-wind8",
  "enemy-stomp": "easyrpg-sound-earth2",
  "enemy-dash": "easyrpg-sound-wind8",
  "enemy-float": "easyrpg-sound-magic2",
  "enemy-shoot": "easyrpg-sound-shot1",
  "enemy-breath": "easyrpg-sound-fire1",
  // 마법 방출(cast_release) 순간. 날아가는 투사체 애니메이션을 이 스킨은 띄우지 않아서, 그 애니메이션의
  // 첫 타이밍 소리(예: 독침 Poison.wav)도 함께 사라졌다 — 시전 도트가 방출하는 순간에 종류별 소리를 낸다.
  "cast-fire": "easyrpg-sound-fire1",
  "cast-ice": "easyrpg-sound-ice1",
  "cast-thunder": "easyrpg-sound-flash3",
  "cast-heal": "easyrpg-sound-holy2",
  "cast-dark": "easyrpg-sound-darkness3",
  "cast-arcane": "easyrpg-sound-magic2",
  "cast-support": "easyrpg-sound-buff",
} as const;
type MotionCue = keyof typeof MOTION_SE;

export function preloadRetroMotionSe(): void {
  preloadBattleSamples([...new Set(Object.values(MOTION_SE))]);
}

/** 날아가는 효과(화살·투사체)인가 — 도트 측면 전투는 이런 애니메이션을 띄우지 않고 시전 도트로 대신한다. */
export function isTravellingEffect(animation: { readonly resourceId?: string; readonly name?: string; readonly animationId?: string } | undefined): boolean {
  if (!animation) return false;
  const text = `${animation.resourceId ?? ""} ${animation.animationId ?? ""} ${animation.name ?? ""}`;
  return /arrow|projectile|missile|bolt-shot|화살|투사체|독침|탄환/i.test(text);
}

function motionSe(cue: MotionCue, volume = 0.3): void {
  if (reduced()) return;
  playBattleSample(MOTION_SE[cue], volume);
}

// ── 캐릭터별 접근 방식 ──────────────────────────────────────────────────────────────────
// 걸어가기가 기본이었는데 "너무 루즈하다" 는 지적(2026-09-28). 직업마다 대상 앞까지 가는 방식을 다르게 한다.
//   dash     전사: 몸을 낮췄다가 잔상을 남기며 질주 → 미끄러지며 벤다
//   leap     수호자: 웅크렸다 높게 도약 → 내리찍기(착지 흙먼지)
//   blink    마도사·성직자: 제자리에서 사라졌다 대상 앞에 나타난다(순간이동)
//   flash    정찰병·궁수·도적: 번개처럼 한 번에 파고든다(아주 짧은 잔상 줄)
// 2026-09-28 확장: 사무라이·음유시인·드루이드·마녀 blink, 닌자 flash, 무도가 dash. 먼저 맞는 줄이 이긴다 —
// 무도가(monk)는 blink 줄의 monk 낱말보다 먼저 dash 로 잡는다.
export type RetroApproachStyle = "dash" | "leap" | "blink" | "flash";

const STYLE_BY_NAME: readonly [RegExp, RetroApproachStyle][] = [
  [/무도가|권사|격투|monk|martial|brawler/i, "dash"],
  [/마도|마법|위저드|mage|wizard|sorcer|witch|마녀|성직|사제|신관|cleric|priest|healer|monk|수녀|사무라이|samurai|음유|시인|bard|드루이드|druid/i, "blink"],
  [/정찰|궁수|도적|닌자|scout|ranger|archer|thief|rogue|ninja|assassin/i, "flash"],
  [/수호|기사|성기사|guard|knight|paladin|tank|전차/i, "leap"],
];

/** 액터(또는 그 직업) 이름으로 접근 방식을 고른다. 모르면 dash. */
export function retroApproachStyle(actorId: string | undefined): RetroApproachStyle {
  const project = store.getCurrent();
  const actor = project.database.actors.find((row) => row.id === actorId);
  const cls = actor ? project.database.classes.find((row) => row.id === actor.classId) : undefined;
  const words = [cls?.id, cls?.name, actor?.id].filter(Boolean).join(" ");
  return STYLE_BY_NAME.find(([pattern]) => pattern.test(words))?.[1] ?? "dash";
}

/**
 * 스타일별 접근 비트 길이(ms). 걷기보다 모두 짧다 — 준비 동작 + 순간 이동 + 휘두름.
 * 2026-09-28 「도약·대시는 더 빠르게」: 질주·도약을 약 30%, 순간이동·섬광을 약 25% 줄였다.
 */
function approachMsFor(style: RetroApproachStyle, path: number): number {
  const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
  if (style === "blink") return 400;
  if (style === "flash") return 290;
  if (style === "leap") return clamp(220 + path / 1.3, 360, 500);
  return clamp(170 + path / 1.2, 300, 440);
}

const approachAnimations = new WeakMap<HTMLElement, Animation>();

/**
 * 근접 접근 비트: 노드 translate 를 스타일별 경로로 움직이고 칸을 고른다. CSS 키프레임(retro-walk-up)은 걷기 전용으로 남긴다.
 * 비율은 비트 길이에 대한 몫이다. 도착 뒤 마지막 구간에 젖힘 → 휘두름(attack_windup → attack_strike).
 */
function animateMeleeApproach(node: HTMLElement, length: number): readonly [number, Pose][] {
  const style = (node.dataset.retroStyle ?? "dash") as RetroApproachStyle;
  const dx = Number.parseFloat(node.style.getPropertyValue("--retro-travel")) || -72;
  const dy = Number.parseFloat(node.style.getPropertyValue("--retro-travel-y")) || 0;
  const start = Number.parseFloat(node.style.getPropertyValue("--retro-start")) || 0;
  const swing = Math.min(0.42, 200 / Math.max(1, length));
  const arrive = 1 - swing;
  type Key = { offset: number; translate: string; opacity?: number; filter?: string; easing?: string };
  const at = (fx: number, fy: number, lift = 0) => `${Math.round(start + (dx - start) * fx)}px ${Math.round(dy * fy - lift)}px`;
  let keys: Key[];
  let frames: [number, Pose][];
  if (style === "leap") {
    const crouch = Math.min(0.28, 140 / Math.max(1, length));
    keys = [
      { offset: 0, translate: at(0, 0) },
      { offset: crouch, translate: at(-0.03, 0, -2), easing: "cubic-bezier(.2,.7,.3,1)" },
      { offset: crouch + (arrive - crouch) * 0.5, translate: at(0.55, 0.45, 46), easing: "cubic-bezier(.6,0,.9,.5)" },
      { offset: arrive, translate: at(1, 1) },
      { offset: 1, translate: at(1, 1) },
    ];
    frames = [[0, "defend"], [crouch, "attack_windup"], [crouch + (arrive - crouch) * 0.55, "attack_strike"], [arrive, "attack"]];
  } else if (style === "blink") {
    const vanish = Math.min(0.34, 170 / Math.max(1, length));
    const appear = vanish + 0.14;
    keys = [
      { offset: 0, translate: at(0, 0), opacity: 1, filter: "none" },
      { offset: vanish * 0.6, translate: at(0, 0), opacity: 1, filter: "brightness(2.2)" },
      { offset: vanish, translate: at(0, 0, 6), opacity: 0, filter: "brightness(3)", easing: "steps(1, end)" },
      { offset: appear, translate: at(1, 1, 6), opacity: 0, filter: "brightness(3)" },
      { offset: appear + 0.1, translate: at(1, 1), opacity: 1, filter: "brightness(1.6)" },
      { offset: 1, translate: at(1, 1), opacity: 1, filter: "none" },
    ];
    frames = [[0, "cast_charge"], [appear, "attack_windup"], [arrive, "attack_strike"]];
  } else if (style === "flash") {
    const ready = Math.min(0.4, 150 / Math.max(1, length));
    const hit = ready + 0.14;
    keys = [
      { offset: 0, translate: at(0, 0) },
      { offset: ready, translate: at(-0.06, 0) , easing: "cubic-bezier(.9,0,1,.2)" },
      { offset: hit, translate: at(1.04, 1) },
      { offset: hit + 0.08, translate: at(1, 1) },
      { offset: 1, translate: at(1, 1) },
    ];
    frames = [[0, "attack_windup"], [ready, "walk_c"], [hit, "attack_strike"]];
  } else {
    const lean = Math.min(0.24, 110 / Math.max(1, length));
    keys = [
      { offset: 0, translate: at(0, 0) },
      { offset: lean, translate: at(-0.05, 0, -1), easing: "cubic-bezier(.5,0,.2,1)" },
      { offset: arrive - 0.06, translate: at(1.06, 1) },
      { offset: arrive, translate: at(1, 1) },
      { offset: 1, translate: at(1, 1) },
    ];
    frames = [[0, "attack_windup"], [lean, "walk_a"], [lean + (arrive - lean) * 0.4, "walk_c"], [arrive - 0.06, "attack_strike"]];
  }
  approachAnimations.get(node)?.cancel();
  const animation = node.animate(keys, { duration: Math.max(1, length), fill: "forwards" });
  approachAnimations.set(node, animation);
  // 이동 효과음: 출발 순간에 한 번(도약은 착지에 한 번 더). 순간이동은 사라지는 순간.
  const departAt = keys[1]?.offset ?? 0;
  const cue: MotionCue = style;
  scheduleBattleTimer(() => { if (node.isConnected) motionSe(cue, style === "blink" ? 0.34 : 0.26); }, Math.round(length * departAt));
  if (style === "leap") scheduleBattleTimer(() => { if (node.isConnected) motionSe("land", 0.32); }, Math.round(length * arrive));
  // 잔상: 질주·섬광은 지나간 자리에 스프라이트 사본을 짧게 남긴다(도트 게임의 잔상 문법).
  if (style === "dash" || style === "flash") spawnAfterimages(node, keys, length, style === "flash" ? 4 : 3);
  if (style === "leap") scheduleBattleTimer(() => spawnDust(node), Math.round(length * arrive));
  return frames;
}

function spawnAfterimages(node: HTMLElement, keys: readonly { offset: number; translate: string }[], length: number, count: number): void {
  const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
  const parent = node.parentElement;
  if (!sprite || !parent) return;
  const from = keys[1]!;
  const to = keys[keys.length - 2]!;
  const parse = (value: string) => value.split(" ").map((part) => Number.parseFloat(part) || 0);
  const [x0, y0] = parse(from.translate);
  const [x1, y1] = parse(to.translate);
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    const delay = Math.round(length * (from.offset + (to.offset - from.offset) * t));
    scheduleBattleTimer(() => {
      if (!node.isConnected) return;
      const ghost = node.cloneNode(false) as HTMLElement;
      ghost.className = "battle-actor retro-afterimage";
      // data-* 를 모두 걷는다 — 남기면 원본의 비트 키프레임·포즈 규칙과 QA 조회가 잔상에도 걸린다.
      for (const name of ghost.getAttributeNames()) if (name.startsWith("data-") || name === "aria-label") ghost.removeAttribute(name);
      ghost.setAttribute("aria-hidden", "true");
      const copy = sprite.cloneNode(false) as HTMLElement;
      copy.removeAttribute("data-testid");
      copy.removeAttribute("role");
      copy.removeAttribute("aria-label");
      ghost.append(copy);
      ghost.style.translate = `${Math.round(x0 + (x1 - x0) * t)}px ${Math.round(y0 + (y1 - y0) * t)}px`;
      parent.append(ghost);
      scheduleBattleTimer(() => ghost.remove(), 220);
    }, delay);
  }
}

function spawnDust(node: HTMLElement): void {
  if (!node.isConnected) return;
  const dust = document.createElement("span");
  dust.className = "retro-landing-dust";
  dust.setAttribute("aria-hidden", "true");
  node.append(dust);
  scheduleBattleTimer(() => dust.remove(), 360);
}

// ── 걸어가서 때리기 ─────────────────────────────────────────────────────────────────────
// 근접 공격(통상 공격·attack 계열 스킬)은 approach 비트 동안 대상 적 **바로 앞**까지 걷는다.
// 거리는 실제 DOM 좌표에서 잰다: 아군 몸 앞(왼쪽) 가장자리 → 적 그림 오른쪽 가장자리 + 여유.
// 시퀀서가 비트 길이를 정하기 전에(actorApproachMs) 한 번, 전진을 걸 때 한 번 부르므로 엔트리별로 기억한다.
// 2026-09-28 「더 빠르게」: 복귀도 0.36 → 0.5 px/ms(튀어 돌아가는 공중제비가 늘어지지 않게).
const RETURN_PX_PER_MS = 0.5;
const WALK_GAP_PX = 6;
const walkCache = new WeakMap<HTMLElement, Map<number, RetroWalk | null>>();

export interface RetroWalk {
  /** 걸어가는 거리(무대 논리 px, 왼쪽이 양수). */
  readonly distance: number;
  /** 대상 발 높이까지의 세로 이동(아래가 양수). */
  readonly dy: number;
  readonly approachMs: number;
  readonly recoverMs: number;
}

/** 이 엔트리가 걸어가서 때리는 행동인가 — 아군의 통상 공격, 또는 공격력으로 치는 피해 스킬. */
function isMeleeEntry(entry: BattleTimelineEntrySnapshot): boolean {
  if (entry.side === "enemy") return false;
  if (entry.commandKind === "attack") return true;
  if (entry.commandKind !== "skill") return false;
  const recipe = retroSkillForEntry(entry);
  if (recipe) return recipe.approach !== "still";
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
  // 같은 종족이 여럿이면 recordId 가 겹친다 — 전투 id(testid) 로 먼저 고르고, 없을 때만 recordId.
  const target = enemies.find((node) => node.dataset.testid === entry.targetId)
    ?? enemies.find((node) => node.dataset.recordId === entry.targetId) ?? enemies[0];
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
  const translate = getComputedStyle(user).translate.split(" ");
  const currentY = Number.parseFloat(translate[1] ?? "0") || 0;
  // 96px 셀 안에서 몸은 가운데 약 40px 이다 — 몸 앞 가장자리 = 셀 가운데 − 20px.
  const bodyFront = (userRect.left + userRect.width / 2) / scale - current - 20;
  // 도트 적 시트는 셀 cell(48·64·96)에서 몸 오른쪽 끝이 x≈cell−12, 바닥선이 y=cell−4 다. 통짜 그림은 오른쪽 투명 여백 약 15%, 바닥이 그림 아래끝.
  const pixel = image.dataset.pixelSheet !== undefined;
  const cell = Number(image.closest<HTMLElement>("[data-pixel-enemy-cell]")?.dataset.pixelEnemyCell) || 48;
  const enemyFront = (pixel ? enemyRect.left + enemyRect.width * ((cell - 12) / cell) : enemyRect.right - enemyRect.width * 0.15) / scale;
  const enemyFeet = (pixel ? enemyRect.top + enemyRect.height * ((cell - 4) / cell) : enemyRect.bottom) / scale;
  // 아군 셀(48px 원본)의 발 마지막 행은 y=44.
  const userFeet = (userRect.top + userRect.height * (45 / 48)) / scale - currentY;
  const distance = Math.round(bodyFront - enemyFront - WALK_GAP_PX);
  // 적보다 조금 앞(화면 아래)에 서야 적 그림을 가리지 않고 맞붙어 보인다.
  const dy = Math.round(enemyFeet - userFeet + 2);
  if (!Number.isFinite(distance) || !Number.isFinite(dy) || distance < 24) return undefined;
  const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
  const path = Math.hypot(distance, dy);
  const style = retroApproachStyle(userId);
  return {
    distance,
    dy,
    approachMs: approachMsFor(style, path),
    // 돌아갈 때는 뒤로 공중제비하듯 튀어 돌아간다(retro-return). 순간이동은 다시 사라졌다 나타난다.
    recoverMs: style === "blink" ? 340 : clamp(path / RETURN_PX_PER_MS, 280, 480),
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

/**
 * 다가가지 않고 제자리에서 근접 칸을 쓰는 도트 적(리소스 id). 계약 motion 은 칸 순서만 빌린 것이다 —
 * 식충 식물은 stomp 칸(내려찍기) 자리에 덩굴 채찍을 그렸다(retroMonsterPlan.ts design).
 * reach 가 없으면 animatePixelEnemyBeat 의 제자리 분기(당겼다 나서기)로 windup → attack → recover 를 그린다.
 */
const ROOTED_PIXEL_ENEMIES: ReadonlySet<string> = new Set(["generated-enemy-plant-carnivore"]);

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
  const enemies = [...field.querySelectorAll<HTMLElement>(".battle-enemy[data-pixel-enemy]:not(.defeated)")];
  const user = enemies.find((node) => node.dataset.testid === entry.userId)
    ?? enemies.find((node) => node.dataset.recordId === entry.userRecordId);
  // 궁수·브레스는 통상 공격이어도 ranged. 대상까지 걸어가지 않는다. 뿌리 박힌 적(식충 식물: stomp 칸이지만 제자리 덩굴 채찍)도 제자리.
  if (user?.dataset.pixelEnemy === "shoot" || user?.dataset.pixelEnemy === "breath") return undefined;
  if (ROOTED_PIXEL_ENEMIES.has(user?.querySelector<HTMLElement>(".battle-enemy-image")?.dataset.pixelSheet ?? "")) return undefined;
  const actors = [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated)")];
  const target = actors.find((node) => node.dataset.testid === entry.targetId)
    ?? actors.find((node) => node.dataset.recordId === entry.targetId);
  const image = user?.querySelector<HTMLElement>(".battle-enemy-image");
  const sprite = target?.querySelector<HTMLElement>(".battle-actor-sprite, .battle-actor-image") ?? target;
  if (!user || !image || !sprite) return undefined;
  const imageRect = image.getBoundingClientRect();
  const actorRect = sprite.getBoundingClientRect();
  if (imageRect.width === 0 || actorRect.width === 0) return undefined;
  // 화면 px → 적 노드 translate 단위(무대 배율 × 필드 zoom). 이미지 자신의 레이아웃 폭 대비 화면 폭으로 잰다.
  const scale = image.offsetWidth > 0 ? imageRect.width / image.offsetWidth : 1;
  const motion = user.dataset.pixelEnemy;
  const hovering = motion === "swoop" || motion === "float";
  const cell = Math.max(1, Number(user.dataset.pixelEnemyCell) || 48);
  // 적 셀은 가변 크기: 앞 가장자리 cell−6, 지면 cell−4, 부유 중심 cell/2−4.
  // 아군 확장 시트는 여전히 48px 셀이다. 적의 비율을 아군에도 적용하면 큰 적이 높이를 잘못 맞춘다.
  const front = imageRect.left + imageRect.width * ((cell - 6) / cell);
  const actorFront = actorRect.left + actorRect.width * ((48 / 2 - 10) / 48);
  const dx = Math.round((actorFront - front) / scale - 2);
  const enemyAnchor = hovering ? cell / 2 - 4 : cell - 4;
  const actorAnchor = hovering ? 20 : 44;
  const dy = Math.round((actorRect.top + actorRect.height * (actorAnchor / 48)
    - (imageRect.top + imageRect.height * (enemyAnchor / cell))) / scale);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return undefined;
  const distance = Math.hypot(dx, dy);
  const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));
  const speed = motion === "dash" ? 0.65 : motion === "stomp" ? 0.34 : hovering ? 0.42 : 0.3;
  return {
    dx,
    dy,
    approachMs: ENEMY_HOLD_MS + clamp(distance / speed, motion === "stomp" ? 440 : 300, 900),
    recoverMs: clamp(160 + distance / (motion === "stomp" ? 0.38 : motion === "dash" ? 0.7 : 0.42), 420, 900),
  };
}

type PathPoint = readonly [offset: number, x: number, y: number, easing?: string];

function animatePixelEnemyBeat(node: HTMLElement, beat: BattleActionBeat): void {
  const generation = (beatGenerations.get(node) ?? 0) + 1;
  beatGenerations.set(node, generation);
  const length = Math.max(0, beat.durationMs);
  const motion = node.dataset.pixelEnemy;
  const swoop = motion === "swoop";
  const stationary = motion === "shoot" || motion === "breath";
  const melee = !stationary && node.dataset.retroReach === "melee";
  // Preserve a measured zero (already next to the target), rather than inventing an 18px lunge.
  const parsedDx = Number.parseFloat(node.style.getPropertyValue("--retro-enemy-dx"));
  const dx = Number.isFinite(parsedDx) ? parsedDx : 18;
  const dy = Number.parseFloat(node.style.getPropertyValue("--retro-enemy-dy")) || 0;
  const cues: [number, MotionCue][] = [];
  let cells: readonly [number, PixelEnemyCell][];
  let path: readonly PathPoint[];
  if (stationary) {
    // The authored neck/bow changes supply the motion. Feet and node remain planted, including recover.
    node.dataset.retroReach = "ranged";
    path = [[0, 0, 0], [1, 0, 0]];
    if (beat.kind === "approach") cells = [[0, "windup"], [motion === "breath" ? 0.7 : 0.55, "move"]];
    else if (beat.kind === "impact") {
      cells = [[0, "attack"]];
      cues.push([0, motion === "breath" ? "enemy-breath" : "enemy-shoot"]);
    } else cells = [[0, "recover"], [0.8, "idle_b"]];
  } else if (melee && beat.kind === "approach") {
    const hold = Math.min(0.45, ENEMY_HOLD_MS / Math.max(1, length));
    const travel = 1 - hold;
    if (motion === "stomp") {
      const first = hold + travel * 0.42;
      const second = hold + travel * 0.82;
      path = [[0, 0, 0], [hold, -3, 1],
        [hold + travel * 0.18, dx * 0.25, dy * 0.25 - 3], [first, dx * 0.5, dy * 0.5 + 2],
        [hold + travel * 0.62, dx * 0.75, dy * 0.75 - 3], [second, dx, dy + 2], [1, dx, dy]];
      cells = [[0, "idle_c"], [hold, "move"], [first, "idle_b"],
        [hold + travel * 0.52, "move"], [second, "windup"]];
      cues.push([first, "enemy-stomp"], [second, "enemy-stomp"]);
    } else if (motion === "dash") {
      path = [[0, 0, 0], [hold, -7, 3, "ease-in"],
        [hold + travel * 0.7, dx * 0.86, dy * 0.86 + 3, "ease-out"], [1, dx, dy]];
      cells = [[0, "windup"], [hold, "move"], [hold + travel * 0.45, "idle_c"], [hold + travel * 0.62, "move"]];
      cues.push([hold, "enemy-dash"]);
    } else if (motion === "float") {
      path = [[0, 0, 0, "ease-in-out"], [hold, -4, -4],
        [hold + travel * 0.5, dx * 0.5, dy * 0.5 - 6], [1, dx, dy]];
      cells = [[0, "windup"], [hold, "move"], [hold + travel * 0.5, "idle_c"], [0.92, "move"]];
      cues.push([hold, "enemy-float"]);
    } else if (swoop) {
      path = [[0, 0, 0, "ease-out"], [hold, -8, -12, "ease-in"], [hold + travel * 0.45, dx * 0.45, dy * 0.35 - 14, "ease-in"], [1, dx, dy]];
      cells = [[0, "windup"], [hold, "move"]];
      cues.push([hold, "enemy-swoop"]);
    } else {
      const land = hold + travel * 0.5;
      path = [[0, 0, 0], [hold * 0.5, -4, 0], [hold, -4, 0, "ease-out"],
        [hold + travel * 0.25, dx * 0.25, dy * 0.25 - 18, "ease-in"], [land, dx * 0.5, dy * 0.5, "ease-out"],
        [land + travel * 0.25, dx * 0.75, dy * 0.75 - 22, "ease-in"], [1, dx, dy]];
      cells = [[0, "windup"], [hold, "move"], [Math.max(hold, land - travel * 0.06), "recover"], [land + travel * 0.06, "move"]];
      cues.push([hold, "enemy-hop"], [land, "enemy-hop"]);
    }
  } else if (melee && beat.kind === "impact") {
    const down = motion === "stomp" ? 4 : swoop ? 2 : 0;
    const push = motion === "float" ? 2 : motion === "dash" ? 8 : 5;
    path = [[0, dx, dy], [0.4, dx + push, dy + down], [1, dx + 2, dy + (swoop ? 1 : 0)]];
    cells = [[0, "attack"]];
  } else if (melee) {
    if (motion === "stomp") {
      path = [[0, dx + 2, dy], [0.2, dx, dy], [0.5, dx * 0.5, dy * 0.5 - 2], [0.65, dx * 0.5, dy * 0.5], [0.95, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.2, "move"], [0.5, "idle_b"], [0.65, "move"], [0.95, "idle_a"]];
    } else if (motion === "dash") {
      path = [[0, dx + 2, dy], [0.18, dx, dy + 2, "ease-in-out"], [0.85, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.18, "move"], [0.85, "idle_a"]];
    } else if (motion === "float") {
      path = [[0, dx + 2, dy, "ease-in-out"], [0.5, dx * 0.5, dy * 0.5 - 5], [1, 0, 0]];
      cells = [[0, "recover"], [0.3, "idle_b"], [0.65, "idle_c"], [0.9, "idle_a"]];
    } else if (swoop) {
      path = [[0, dx + 2, dy + 1, "ease-out"], [0.3, dx * 0.75, dy - 16], [0.9, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.3, "idle_a"], [0.45, "idle_c"], [0.6, "idle_a"], [0.75, "idle_c"], [0.9, "idle_b"]];
    } else {
      path = [[0, dx + 2, dy], [0.22, dx, dy, "ease-out"], [0.6, dx * 0.45, dy * 0.45 - 24, "ease-in"], [0.92, 0, 0], [1, 0, 0]];
      cells = [[0, "recover"], [0.22, "move"], [0.9, "recover"]];
    }
  } else if (beat.kind === "approach") {
    path = [[0, 0, 0, "ease-out"], [0.6, -6, swoop ? -6 : 0], [1, -6, swoop ? -6 : 0]];
    cells = [[0, "windup"]];
  } else if (beat.kind === "impact") {
    path = [[0, -6, swoop ? -6 : 0, "ease-out"], [0.5, dx, 0], [1, dx, 0]];
    cells = [[0, "attack"]];
  } else {
    path = [[0, dx, 0, "ease-in-out"], [0.8, 0, 0], [1, 0, 0]];
    cells = [[0, "recover"], [0.55, swoop ? "idle_a" : "idle_b"]];
  }
  // Cue zero is synchronous with the attack cell; delayed cues belong to this beat generation only.
  if (!reduced()) for (const [fraction, cue] of cues) {
    const play = () => {
      if (node.isConnected && beatGenerations.get(node) === generation && node.dataset.retroBeat === beat.kind) motionSe(cue, 0.22);
    };
    if (fraction === 0) play();
    else if (length > 0) scheduleBattleTimer(play, Math.min(length - 1, Math.round(length * fraction)));
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
