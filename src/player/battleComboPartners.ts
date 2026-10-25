/**
 * 연계기 동료 동작 — 크로노 트리거 더블 테크처럼 **참가자 모두가** 움직인다(2026-10-25 폴른 스타 지적: 「협공기인데 한 명만 움직인다」).
 *
 * 시전자는 기존 경로(도트 연출 choreographyId 또는 일반 접근)를 그대로 탄다. 이 모듈은 나머지 참가자를 맡는다:
 *   1. 컷인이 끝나 행동이 시작되면 동료가 자리를 잡는다 — rush 는 대상 적 앞(시전자와 겹치지 않게 위아래로 비켜)까지 달려가고,
 *      cast/ranged 는 반 걸음 나와 준비 자세.
 *   2. 착탄마다 동료가 돌아가며 한 번씩 친다(베기·시전 방출·쏘기) — 차례로 이어지는 연타.
 *   3. 마지막 타 뒤(연계 행동 끝) 참가자 모두가 함께 마무리 자세 + 빛 → 제자리로 돌아온다.
 * 동작 종류는 SkillRecord.comboStaging.partners(auto·rush·cast·ranged). 표시 전용 — 피해·차례와 무관하다.
 */
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { Project, SkillRecord } from "@/project/types";
import type { ComboPartnerAction } from "@/project/battleStaging";
import { battleCharacterMotion } from "@/player/battleMotionContext";
import { setRetroPartnerFrame } from "@/player/battleRetroMotion";
import { playBattleSample } from "@/player/battleSeSamples";

type Mode = Exclude<ComboPartnerAction, "auto">;

interface Partner {
  readonly node: HTMLElement;
  readonly mode: Mode;
  readonly dx: number;
  readonly dy: number;
  anim?: Animation;
}

interface ComboRun {
  readonly key: string;
  readonly casterId?: string;
  readonly partners: Partner[];
  readonly speed: number;
  strikes: number;
  ended: boolean;
  finishing: boolean;
  settle?: number;
  timers: number[];
}

const runs = new WeakMap<HTMLElement, ComboRun>();
const reduced = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 동료 하나가 할 일. 명시가 없으면 그 동료의 요구 기술(마법 → cast)과 캐릭터 동작(원거리 → ranged)으로 정한다. */
export function comboPartnerMode(project: Project, skill: SkillRecord | undefined, actorId: string, field?: HTMLElement): Mode {
  const explicit = skill?.comboStaging?.partners;
  if (explicit && explicit !== "auto") return explicit;
  const requiredId = skill?.comboRequires?.find((row) => row.actorId === actorId)?.skillId;
  const required = requiredId ? project.database.skills.find((record) => record.id === requiredId) : undefined;
  const magic = required ? (required as { statistic?: string; damage?: { statistic?: string } }).damage?.statistic === "mind"
    || /(fire|ice|thunder|holy|dark|blizzard|lightning|heal|magic|mage)/i.test(required.id) : false;
  if (magic) return "cast";
  const motion = field ? battleCharacterMotion(field, actorId) : undefined;
  if (motion?.style === "ranged" || (required && /(gun|snipe|bow|arrow|shot)/i.test(required.id))) return "ranged";
  return "rush";
}

function sfx(id: string, volume = 0.28): void {
  if (!reduced()) playBattleSample(id, volume);
}

/**
 * 달려든 동료 slot(시전자 제외 0부터)의 자리 — 시전자는 적 바로 앞 가운데에 선다.
 * 동료 하나·둘은 위·아래 안쪽 줄, 셋째(4인 연계)는 바깥 위 줄에 반 걸음 뒤로 서서 적을 둘러싼다.
 * 안쪽 줄과 바깥 줄은 몸 반쯤(22px) 벌어져 칩이 포개지지 않는다. back 은 적 쪽으로 덜 다가서는 px.
 */
export function comboRushSlot(slot: number): { dy: number; back: number } {
  const ring = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? -1 : 1;
  return { dy: side * (16 + 22 * ring), back: 6 * (slot % 2) + 14 * ring };
}

function measureRush(field: HTMLElement, node: HTMLElement, entry: BattleTimelineEntrySnapshot, slot: number): { dx: number; dy: number } {
  const enemies = [...field.querySelectorAll<HTMLElement>(".battle-enemy:not(.defeated)")];
  const target = enemies.find((enemy) => enemy.dataset.testid === entry.targetId)
    ?? enemies.find((enemy) => enemy.dataset.recordId === entry.targetId) ?? enemies[0];
  const rect = node.getBoundingClientRect();
  if (!target || rect.width === 0) return { dx: -72, dy: 0 };
  const scale = node.offsetWidth > 0 ? rect.width / node.offsetWidth : 1;
  const image = target.querySelector<HTMLElement>(".battle-enemy-image") ?? target;
  const enemyRect = image.getBoundingClientRect();
  const bodyFront = (rect.left + rect.width / 2) / scale - 20;
  const enemyFront = (enemyRect.right - enemyRect.width * 0.15) / scale;
  const userFeet = (rect.top + rect.height * (45 / 48)) / scale;
  const enemyFeet = enemyRect.bottom / scale;
  const { dy: spread, back } = comboRushSlot(slot);
  const dx = -Math.max(0, Math.round(bodyFront - enemyFront - 10 - back));
  const dy = Math.round(enemyFeet - userFeet + spread);
  return { dx: Number.isFinite(dx) ? dx : -72, dy: Number.isFinite(dy) ? Math.max(-90, Math.min(90, dy)) : 0 };
}

function moveTo(partner: Partner, from: [number, number], to: [number, number], durationMs: number): void {
  partner.anim?.cancel();
  if (typeof partner.node.animate !== "function" || durationMs <= 0) {
    partner.node.style.translate = `${to[0]}px ${to[1]}px`;
    return;
  }
  partner.anim = partner.node.animate(
    [{ translate: `${from[0]}px ${from[1]}px` }, { translate: `${to[0]}px ${to[1]}px` }],
    { duration: durationMs, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" },
  );
}

function walkFrames(run: ComboRun, partner: Partner, durationMs: number): void {
  const frames = ["walk_a", "walk_b", "walk_c", "walk_b"] as const;
  const step = 90;
  for (let t = 0, i = 0; t < durationMs; t += step, i += 1) {
    const frame = frames[i % frames.length]!;
    run.timers.push(window.setTimeout(() => { if (!run.ended) setRetroPartnerFrame(partner.node, frame); }, t));
  }
}

/** 컷인이 끝나고 행동이 시작되는 순간(leadMs 뒤). 동료가 자리를 잡는다. */
export function startComboPartners(root: HTMLElement, entry: BattleTimelineEntrySnapshot, project: Project, leadMs: number, speed = 1): void {
  const existing = runs.get(root);
  if (existing && !existing.ended && existing.key === `${entry.actionId ?? entry.sequence}`) return;
  stopComboPartners(root, true);
  const members = entry.comboActorIds ?? [];
  const casterId = entry.userRecordId ?? entry.userId;
  const field = root.querySelector<HTMLElement>(".battle-field") ?? root;
  const skill = project.database.skills.find((record) => record.id === entry.skillId);
  const actors = [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated)")];
  const partnerIds = members.filter((id) => id !== casterId);
  if (partnerIds.length === 0) return;
  const run: ComboRun = { key: `${entry.actionId ?? entry.sequence}`, casterId, partners: [], speed: Math.max(0.25, speed), strikes: 0, ended: false, finishing: false, timers: [] };
  runs.set(root, run);
  root.dataset.battleComboPartners = String(partnerIds.length);
  const begin = (): void => {
    if (run.ended) return;
    partnerIds.forEach((id, slot) => {
      const node = actors.find((candidate) => candidate.dataset.recordId === id);
      if (!node) return;
      const mode = comboPartnerMode(project, skill, id, field);
      const at = mode === "rush" ? measureRush(field, node, entry, slot) : { dx: -18, dy: 0 };
      const partner: Partner = { node, mode, dx: at.dx, dy: at.dy };
      run.partners.push(partner);
      node.dataset.comboPartner = mode;
      const delay = slot * 110;
      const travel = mode === "rush" ? Math.round(Math.min(520, Math.max(240, Math.abs(at.dx) * 2.2)) / run.speed) : Math.round(220 / run.speed);
      run.timers.push(window.setTimeout(() => {
        if (run.ended) return;
        moveTo(partner, [0, 0], [at.dx, at.dy], reduced() ? 0 : travel);
        if (mode === "rush") {
          sfx("easyrpg-sound-wind8");
          walkFrames(run, partner, travel);
          run.timers.push(window.setTimeout(() => { if (!run.ended) setRetroPartnerFrame(node, "attack_windup"); }, travel));
        } else {
          setRetroPartnerFrame(node, mode === "cast" ? "cast_charge" : "attack_windup");
          run.timers.push(window.setTimeout(() => { if (!run.ended && mode === "cast") setRetroPartnerFrame(node, "cast_raise"); }, travel));
        }
      }, Math.round(delay / run.speed)));
    });
    // 안전판: 착탄도 끝 신호도 없으면 7초 뒤 돌아간다.
    run.timers.push(window.setTimeout(() => finishComboPartners(root), Math.round(7000 / run.speed)));
  };
  if (leadMs > 0) run.timers.push(window.setTimeout(begin, Math.round(leadMs)));
  else begin();
}

/** 착탄 한 번 — 동료가 돌아가며 친다(첫 착탄은 모두 함께 들어간다). */
export function comboPartnersStrike(root: HTMLElement): void {
  const run = runs.get(root);
  if (!run || run.ended || run.finishing || run.partners.length === 0) return;
  const first = run.strikes === 0;
  const hitters = first ? run.partners : [run.partners[(run.strikes - 1) % run.partners.length]!];
  run.strikes += 1;
  // 마지막 타: 착탄이 잠시 끊기면 그때가 끝이다 — 모두 함께 마무리.
  if (run.settle !== undefined) window.clearTimeout(run.settle);
  run.settle = window.setTimeout(() => finishComboPartners(root), Math.round(700 / run.speed));
  run.timers.push(run.settle);
  hitters.forEach((partner, index) => {
    run.timers.push(window.setTimeout(() => {
      if (run.ended) return;
      const strike = partner.mode === "cast" ? "cast_release" : "attack_strike";
      setRetroPartnerFrame(partner.node, strike);
      if (partner.mode === "rush") sfx("easyrpg-sound-attack2", 0.22);
      else if (partner.mode === "ranged") sfx("easyrpg-sound-shot1", 0.22);
      // 베는 순간 앞으로 한 번 더 내지른다.
      if (partner.mode !== "cast" && typeof partner.node.animate === "function" && !reduced()) {
        partner.node.animate(
          [{ translate: `${partner.dx}px ${partner.dy}px` }, { translate: `${partner.dx - 10}px ${partner.dy}px` }, { translate: `${partner.dx}px ${partner.dy}px` }],
          { duration: Math.round(180 / run.speed), composite: "replace" },
        );
      }
      run.timers.push(window.setTimeout(() => {
        if (!run.ended) setRetroPartnerFrame(partner.node, partner.mode === "cast" ? "cast_raise" : "attack_follow");
      }, Math.round(160 / run.speed)));
    }, Math.round((index * 90) / run.speed)));
  });
}

/** 연계 행동 끝 — 모두 함께 마무리 자세와 빛, 그리고 제자리로. */
export function finishComboPartners(root: HTMLElement): void {
  const run = runs.get(root);
  if (!run || run.ended || run.finishing) return;
  if (run.partners.length === 0) { stopComboPartners(root, true); return; }
  run.finishing = true;
  // 마무리: 참가자 전원(시전자 포함) 같은 순간 «skill» 자세 + 빛.
  const field = root.querySelector<HTMLElement>(".battle-field") ?? root;
  const caster = [...field.querySelectorAll<HTMLElement>(".battle-actor")].filter((node) => node.dataset.recordId === run.casterId);
  const glowing = [...run.partners.map((partner) => partner.node), ...caster];
  for (const partner of run.partners) setRetroPartnerFrame(partner.node, "skill");
  for (const node of glowing) node.classList.add("battle-combo-finisher-glow");
  root.dataset.battleComboFinisher = "true";
  sfx("easyrpg-sound-flash1", 0.24);
  run.timers.push(window.setTimeout(() => {
    for (const node of glowing) node.classList.remove("battle-combo-finisher-glow");
    delete root.dataset.battleComboFinisher;
    for (const partner of run.partners) {
      const back = partner.mode === "rush" ? Math.round(300 / run.speed) : Math.round(180 / run.speed);
      moveTo(partner, [partner.dx, partner.dy], [0, 0], reduced() ? 0 : back);
      if (partner.mode === "rush") walkFrames(run, partner, back);
      run.timers.push(window.setTimeout(() => stopComboPartners(root, false), back + 40));
    }
  }, Math.round(520 / run.speed)));
}

/** 정리 — 칸·이동을 놓아 준다. */
export function stopComboPartners(root: HTMLElement, immediate: boolean): void {
  const run = runs.get(root);
  if (!run) return;
  run.ended = true;
  for (const timer of run.timers) window.clearTimeout(timer);
  for (const partner of run.partners) {
    partner.anim?.cancel();
    partner.node.style.translate = "";
    partner.node.classList.remove("battle-combo-finisher-glow");
    delete partner.node.dataset.comboPartner;
    setRetroPartnerFrame(partner.node, undefined);
  }
  delete root.dataset.battleComboPartners;
  if (immediate) delete root.dataset.battleComboFinisher;
  runs.delete(root);
}

/** QA: 지금 움직이는 동료 수·착탄 수. */
export function comboPartnersSnapshot(root: HTMLElement): { readonly partners: number; readonly strikes: number } | null {
  const run = runs.get(root);
  return run ? { partners: run.partners.length, strikes: run.strikes } : null;
}
