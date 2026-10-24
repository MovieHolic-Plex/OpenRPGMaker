/**
 * 연계기(듀얼·트리플 테크) 발동 연출 — 크로노 트리거·FF 식 「얼굴 교차」 컷인 + 화려한 착탄(2026-10-24 → 2026-10-25 fs-battle-3).
 *
 * 사용자: 「연계기 할 때, 서로의 얼굴이 교차하는 느낌으로」「연계기는 좀 더 화려해야함」.
 *
 * 행동 앞(시퀀서 entryLeadMs 동안, 행동은 그 뒤에 시작한다):
 *   1. 화면 번쩍임 + 어두운 막 + 집중선, 무대가 살짝 확대된다(comboFx spectacular).
 *   2. 참가자 흉상이 양쪽에서 기운 판에 실려 미끄러져 들어와 가운데서 엇갈려 겹친다(트리플은 세 줄). 겹친 자리에 빛 사선.
 *   3. 큰 제목 카드(「듀얼 테크」 + 기술 이름)가 튀어나오고, 흉상들이 서로를 지나쳐 반대편으로 빠져나간다.
 *   4. 참가자 발밑에서 각자의 빛(그 사람이 해금 조건으로 배운 기술의 속성 색)이 차례로 솟는다.
 * 착탄(comboImpact, 행동의 피해마다):
 *   첫 타 — 흰 번쩍임 → 합쳐진 마무리 폭발(참가자 색이 모인 고리·파편), 무대 흔들림, 짧은 느린 화면(무대 애니메이션 재생 속도 0.3배).
 *   타마다 — 피해 숫자 폭발(큰 숫자 + 방사 파편).
 *
 * 전역 세기: system.battleStaging(comboCutIn faces/band/off · comboFx spectacular/simple). 기술 하나: SkillRecord.comboStaging
 * (tint·shake·slowMo·kicker). 흉상은 공용 흉상(외형의 bust 칸 → 얼굴의 공용 표정 세트 흉상, 결의 표정 우선), 없으면 48px 얼굴.
 * 피해·위력 계산과 무관한 표시 전용이다. 기술의 도트 연출은 기존 경로(retroChoreographyId) 그대로 그 뒤에 재생된다.
 */
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { findSharedPortrait, resolveSharedPortraitUrl, sharedExpressionSetIdOf, sharedPortraitId, sharedPortraitWithExpression } from "@/assets/sharedPortraitAssets";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import { resolveBattleStaging, type ComboShake, type ResolvedBattleStaging } from "@/project/battleStaging";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import type { Project, SkillRecord } from "@/project/types";
import { playBattleSfx } from "@/player/battleSfx";

/** 컷인 길이(배속 1). 행동은 이 시간 뒤에 시작한다. */
const FACES_LEAD_MS = 1650;
const BAND_LEAD_MS = 900;
const MEMBER_MS = 1300;

/** 속성 색 — 번쩍임·오라·제목. 모르는 속성은 별빛 금색. */
const ELEMENT_TINT: Readonly<Record<string, string>> = {
  fire: "#ff7a3d", ice: "#7fe3ff", thunder: "#ffe14d", water: "#4fa8ff", wind: "#7dffb0", earth: "#c8955a",
  holy: "#fff2a8", dark: "#b47bff", poison: "#9be05a", sword: "#dfe7f2", spear: "#c2d2e8", bow: "#a6f08a", hit: "#ffb066",
};
const FALLBACK_TINT = "#ffd76a";

export interface ComboCutInContext {
  readonly project: Project;
  readonly actorName: (recordId: string) => string;
  readonly skillName: (entry: BattleTimelineEntrySnapshot) => string;
  /** 연출 배속(빠르게 보기). 1 = 그대로. */
  readonly speed?: number;
}

const reducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function skillOf(project: Project, entry: BattleTimelineEntrySnapshot): SkillRecord | undefined {
  return entry.skillId ? project.database.skills.find((skill) => skill.id === entry.skillId) : undefined;
}

export function comboTint(skill: SkillRecord | undefined): string {
  return skill?.comboStaging?.tint ?? (skill?.elementId ? ELEMENT_TINT[skill.elementId] : undefined) ?? FALLBACK_TINT;
}

/** 참가자 한 사람의 색 — 그 사람이 이 연계기 해금 조건으로 배운 기술의 속성 색(없으면 연계기 색). */
function memberTint(project: Project, skill: SkillRecord | undefined, actorId: string): string {
  const requiredId = skill?.comboRequires?.find((row) => row.actorId === actorId)?.skillId;
  const required = requiredId ? project.database.skills.find((record) => record.id === requiredId) : undefined;
  return (required?.elementId ? ELEMENT_TINT[required.elementId] : undefined) ?? comboTint(skill);
}

/**
 * 배우의 흉상 그림 주소 — 외형(appearance)의 흉상 → 얼굴이 속한 공용 표정 세트의 흉상(결의 → 기본) → 48px 얼굴.
 * 전신은 쓰지 않는다(컷인 판에는 어깨 위만 들어간다).
 */
export function actorBustImage(project: Project, actorId: string): { readonly url: string; readonly kind: "bust" | "face" } | undefined {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) return undefined;
  const resolve = (resourceId: string): string | undefined => resolveSharedPortraitUrl(resourceId) ?? resolveAssetResourceUrl(resourceId, { project }) ?? undefined;
  const appearance = resolveAppearancePortrait(project, actor.appearanceId, "bust");
  if (appearance?.presentation === "bust") {
    const id = sharedPortraitWithExpression(appearance.resourceId, "determined") ?? appearance.resourceId;
    const url = resolve(id);
    if (url) return { url, kind: "bust" };
  }
  const face = appearance?.resourceId ?? actor.faceResourceId;
  const setId = sharedExpressionSetIdOf(face);
  if (setId) {
    const base = sharedPortraitId(setId, "bust", "base");
    if (findSharedPortrait(base)) {
      const id = sharedPortraitWithExpression(base, "determined") ?? base;
      const url = resolve(id);
      if (url) return { url, kind: "bust" };
    }
  }
  const url = face ? resolve(face) : undefined;
  return url ? { url, kind: "face" } : undefined;
}

function span(className: string, text?: string): HTMLElement {
  const node = document.createElement("span");
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 같은 행동의 엔트리가 여럿(대상 × 타수) 와도 한 번만 띄운다. 띄웠으면 행동 앞에 둘 시간(ms, 배속 적용 전)을 돌려준다 —
 * 시퀀서 entryLeadMs 가 그만큼 행동을 늦춘다. 이미 띄웠거나 연계기가 아니면 0.
 */
export function playComboCutIn(root: HTMLElement, entry: BattleTimelineEntrySnapshot, context: ComboCutInContext): number {
  const members = entry.comboActorIds;
  if (!members || members.length < 2 || entry.side !== "actor") return 0;
  const key = `${entry.actionId ?? entry.sequence}:${entry.skillId ?? ""}`;
  if (root.dataset.battleComboShown === key) return 0;
  root.dataset.battleComboShown = key;
  const project = context.project;
  const staging = resolveBattleStaging(project.system.battleStaging);
  const skill = skillOf(project, entry);
  const speed = context.speed && context.speed > 0 ? context.speed : 1;
  const ordered = entry.userRecordId ? [entry.userRecordId, ...members.filter((id) => id !== entry.userRecordId)] : [...members];
  const tint = comboTint(skill);
  const reduced = reducedMotion();
  const mode = staging.comboCutIn;
  const spectacular = staging.comboFx === "spectacular" && !reduced;
  const leadMs = mode === "faces" ? FACES_LEAD_MS : mode === "band" ? BAND_LEAD_MS : 0;
  const stage = root.querySelector<HTMLElement>(".battle-field") ?? root;
  root.dataset.battleComboActive = key;
  root.style.setProperty("--combo-tint", tint);
  if (mode === "faces") mountFaces(root, ordered, skill, context, entry, tint, leadMs / speed, spectacular);
  else if (mode === "band") mountBand(stage, ordered, context, entry, leadMs / speed);
  // 무대 확대(행동 앞 + 착탄 직후까지) — 화면 전체가 「들어간다」.
  if (spectacular) {
    stage.classList.remove("battle-combo-zoom");
    void stage.offsetWidth;
    stage.style.setProperty("--combo-zoom-ms", `${Math.round((leadMs + 900) / speed)}ms`);
    stage.classList.add("battle-combo-zoom");
    window.setTimeout(() => stage.classList.remove("battle-combo-zoom"), Math.round((leadMs + 900) / speed) + 50);
  }
  // 시작 번쩍임.
  const flash = span("battle-combo-flash");
  flash.setAttribute("aria-hidden", "true");
  root.append(flash);
  window.setTimeout(() => flash.remove(), Math.round(520 / speed));
  // 참가자별 빛 — 컷인이 빠지기 시작할 때 차례로 솟는다(한 사람씩 → 착탄에서 하나로 합쳐진다).
  const auraStart = Math.max(0, leadMs - 600);
  ordered.forEach((recordId, index) => {
    window.setTimeout(() => memberAura(root, stage, recordId, memberTint(project, skill, recordId), speed, spectacular), Math.round((auraStart + index * 160) / speed));
  });
  playBattleSfx("combo");
  return leadMs;
}

function mountFaces(
  root: HTMLElement,
  ordered: readonly string[],
  skill: SkillRecord | undefined,
  context: ComboCutInContext,
  entry: BattleTimelineEntrySnapshot,
  tint: string,
  durationMs: number,
  spectacular: boolean,
): void {
  root.querySelector(".battle-combo-faces")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "battle-combo-faces";
  overlay.dataset.testid = "battle-combo-faces";
  overlay.dataset.members = String(ordered.length);
  overlay.dataset.fx = spectacular ? "spectacular" : "simple";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--combo-ms", `${Math.round(durationMs)}ms`);
  overlay.style.setProperty("--combo-tint", tint);
  const dim = span("battle-combo-faces-dim");
  const lines = span("battle-combo-faces-lines");
  for (let i = 0; i < 14; i += 1) {
    const line = document.createElement("i");
    line.style.setProperty("--line-i", String(i));
    line.style.setProperty("--line-y", `${(i * 41) % 100}%`);
    line.style.setProperty("--line-d", `${(i * 67) % 300}ms`);
    lines.append(line);
  }
  overlay.append(dim, lines);
  ordered.forEach((recordId, index) => {
    const panel = document.createElement("div");
    panel.className = "battle-combo-face";
    panel.dataset.slot = String(index);
    // 짝수 칸은 왼쪽에서, 홀수 칸은 오른쪽에서 들어와 서로를 지나쳐 반대편으로 나간다.
    panel.dataset.from = index % 2 === 0 ? "left" : "right";
    panel.dataset.testid = `battle-combo-face-${recordId}`;
    panel.style.setProperty("--member-tint", memberTint(context.project, skill, recordId));
    const image = actorBustImage(context.project, recordId);
    const art = span("battle-combo-face-art");
    if (image) {
      art.style.backgroundImage = `url("${image.url.replace(/["\\]/gu, "")}")`;
      art.dataset.kind = image.kind;
    } else art.dataset.kind = "none";
    const name = span("battle-combo-face-name", context.actorName(recordId));
    panel.append(art, name);
    overlay.append(panel);
  });
  const slash = span("battle-combo-faces-slash");
  const title = document.createElement("div");
  title.className = "battle-combo-title";
  title.dataset.testid = "battle-combo-title";
  const kicker = skill?.comboStaging?.kicker ?? (ordered.length >= 3 ? "트리플 테크" : "듀얼 테크");
  title.append(span("battle-combo-title-kicker", kicker), span("battle-combo-title-name", context.skillName(entry)));
  overlay.append(slash, title);
  root.append(overlay);
  window.setTimeout(() => overlay.remove(), Math.round(durationMs) + 80);
}

function mountBand(stage: HTMLElement, ordered: readonly string[], context: ComboCutInContext, entry: BattleTimelineEntrySnapshot, durationMs: number): void {
  stage.querySelector(".battle-combo-cutin")?.remove();
  const band = document.createElement("div");
  band.className = "battle-combo-cutin";
  band.dataset.testid = "battle-combo-cutin";
  band.dataset.members = String(ordered.length);
  band.style.setProperty("--combo-ms", `${Math.round(durationMs)}ms`);
  band.append(
    span("battle-combo-cutin-label", ordered.length >= 3 ? "트리플 연계!" : "연계!"),
    span("battle-combo-cutin-names", ordered.map((id) => context.actorName(id)).join(" × ")),
    Object.assign(document.createElement("strong"), { className: "battle-combo-cutin-skill", textContent: context.skillName(entry) }),
  );
  stage.append(band);
  window.setTimeout(() => band.remove(), Math.round(durationMs) + 120);
}

/** 참가자 한 사람의 발밑 빛 고리와 솟는 별빛 — 그 사람의 색. 노드 자체가 아니라 무대 위 겹(배틀러 노드는 다시 그려진다). */
function memberAura(root: HTMLElement, stage: HTMLElement, recordId: string, tint: string, speed: number, spectacular: boolean): void {
  const node = root.querySelector<HTMLElement>(`[data-testid="battle-actor-${CSS.escape(recordId)}"]`);
  if (!node || !stage.isConnected) return;
  const rect = node.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const aura = span("battle-combo-aura");
  aura.dataset.testid = `battle-combo-aura-${recordId}`;
  aura.setAttribute("aria-hidden", "true");
  aura.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
  aura.style.top = `${rect.top - stageRect.top + rect.height}px`;
  aura.style.setProperty("--aura-w", `${Math.max(28, rect.width * 1.3)}px`);
  aura.style.setProperty("--aura-tint", tint);
  aura.style.setProperty("--combo-member-ms", `${Math.round(MEMBER_MS / speed)}ms`);
  aura.style.setProperty("--combo-delay", "0ms");
  for (let i = 0; i < (spectacular ? 10 : 6); i += 1) {
    const mote = document.createElement("i");
    mote.style.setProperty("--mote-i", String(i));
    aura.append(mote);
  }
  // 몸을 감싸는 빛기둥(spectacular).
  if (spectacular) aura.append(span("battle-combo-aura-pillar"));
  stage.append(aura);
  window.setTimeout(() => aura.remove(), Math.round(MEMBER_MS / speed) + 120);
  node.classList.add("battle-combo-member");
  window.setTimeout(() => node.classList.remove("battle-combo-member"), Math.round(MEMBER_MS / speed) + 80);
}

/** 이 연계 행동에서 이미 첫 착탄 연출을 했는가(행동 키별). */
const impactedActions = new WeakMap<HTMLElement, string>();

/**
 * 연계기 착탄 — 행동의 피해마다 부른다(battleDom onDamageFeedback). 첫 타에 번쩍임·합쳐진 마무리·흔들림·느린 화면,
 * 타마다 피해 숫자 폭발. 연계 행동 중이 아니면 아무것도 하지 않는다.
 */
export function comboImpact(root: HTMLElement, project: Project, targetNode: HTMLElement | null | undefined, amount: number, critical: boolean, speed = 1): void {
  const key = root.dataset.battleComboActive;
  if (!key) return;
  const staging: ResolvedBattleStaging = resolveBattleStaging(project.system.battleStaging);
  const skillId = key.split(":").slice(1).join(":");
  const skill = skillId ? project.database.skills.find((record) => record.id === skillId) : undefined;
  const reduced = reducedMotion();
  const spectacular = staging.comboFx === "spectacular" && !reduced;
  const tint = comboTint(skill);
  const stage = root.querySelector<HTMLElement>(".battle-field") ?? root;
  const first = impactedActions.get(root) !== key;
  const at = targetCenter(stage, targetNode);
  if (first) {
    impactedActions.set(root, key);
    const flash = span("battle-combo-flash battle-combo-flash-impact");
    flash.setAttribute("aria-hidden", "true");
    root.append(flash);
    window.setTimeout(() => flash.remove(), Math.round(600 / speed));
    if (spectacular) {
      const members = skill?.comboActorIds ?? [];
      finisherBurst(stage, at, tint, members.map((id) => memberTint(project, skill, id)), speed);
      const shake: ComboShake = skill?.comboStaging?.shake ?? (members.length >= 3 ? "heavy" : "light");
      if (shake !== "none") {
        root.classList.remove("battle-combo-shake-light", "battle-combo-shake-heavy");
        void root.offsetWidth;
        root.classList.add(`battle-combo-shake-${shake}`);
        window.setTimeout(() => root.classList.remove(`battle-combo-shake-${shake}`), Math.round(560 / speed));
      }
      if (skill?.comboStaging?.slowMo !== false) slowMotion(stage, Math.round(420 / speed));
    }
    playBattleSfx("comboImpact");
  }
  if (spectacular && amount > 0) numberBurst(stage, at, amount, critical, tint, speed);
}

/** 연계 행동이 끝나면 표식을 걷는다(다음 일반 행동의 피해에 폭발이 붙지 않게). */
export function endComboAction(root: HTMLElement): void {
  delete root.dataset.battleComboActive;
}

function targetCenter(stage: HTMLElement, node: HTMLElement | null | undefined): { x: number; y: number } {
  const stageRect = stage.getBoundingClientRect();
  const image = node?.querySelector<HTMLElement>(".battle-enemy-image, .battle-actor-sprite") ?? node;
  const rect = image?.getBoundingClientRect();
  if (!rect || rect.width < 1) return { x: stageRect.width * 0.3, y: stageRect.height * 0.5 };
  return { x: rect.left - stageRect.left + rect.width / 2, y: rect.top - stageRect.top + rect.height / 2 };
}

/** 합쳐진 마무리 — 참가자 색 고리가 한 점으로 모였다가 큰 고리·파편으로 터진다. */
function finisherBurst(stage: HTMLElement, at: { x: number; y: number }, tint: string, memberTints: readonly string[], speed: number): void {
  const burst = span("battle-combo-finisher");
  burst.dataset.testid = "battle-combo-finisher";
  burst.setAttribute("aria-hidden", "true");
  burst.style.left = `${at.x}px`;
  burst.style.top = `${at.y}px`;
  burst.style.setProperty("--combo-tint", tint);
  burst.style.setProperty("--finisher-ms", `${Math.round(900 / speed)}ms`);
  memberTints.forEach((memberTint, index) => {
    const ring = span("battle-combo-finisher-gather");
    ring.style.setProperty("--member-tint", memberTint);
    ring.style.setProperty("--gather-angle", `${(360 / Math.max(1, memberTints.length)) * index}deg`);
    burst.append(ring);
  });
  burst.append(span("battle-combo-finisher-core"), span("battle-combo-finisher-ring"), span("battle-combo-finisher-ring battle-combo-finisher-ring-2"));
  for (let i = 0; i < 16; i += 1) {
    const shard = document.createElement("i");
    shard.style.setProperty("--shard-a", `${i * 22.5 + ((i * 37) % 11)}deg`);
    shard.style.setProperty("--shard-d", `${70 + ((i * 53) % 60)}px`);
    shard.style.setProperty("--shard-tint", memberTints[i % Math.max(1, memberTints.length)] ?? tint);
    burst.append(shard);
  }
  stage.append(burst);
  window.setTimeout(() => burst.remove(), Math.round(1000 / speed));
}

/** 피해 숫자 폭발 — 큰 숫자가 튀어 오르고 방사 파편이 흩어진다(일반 피해 숫자 위에 겹친다). */
function numberBurst(stage: HTMLElement, at: { x: number; y: number }, amount: number, critical: boolean, tint: string, speed: number): void {
  const node = span("battle-combo-number");
  node.dataset.testid = "battle-combo-number";
  node.dataset.critical = critical ? "true" : "false";
  node.style.left = `${at.x}px`;
  node.style.top = `${at.y}px`;
  node.style.setProperty("--combo-tint", tint);
  node.style.setProperty("--number-ms", `${Math.round(950 / speed)}ms`);
  // 같은 자리에 여러 타가 겹치면 조금씩 비껴 쌓는다.
  const stacked = stage.querySelectorAll(".battle-combo-number").length;
  node.style.setProperty("--number-dy", `${-stacked * 14}px`);
  node.style.setProperty("--number-dx", `${(stacked % 2 ? 1 : -1) * stacked * 8}px`);
  node.append(span("battle-combo-number-value", String(amount)));
  for (let i = 0; i < 8; i += 1) {
    const shard = document.createElement("i");
    shard.style.setProperty("--shard-a", `${i * 45 + 20}deg`);
    node.append(shard);
  }
  stage.append(node);
  window.setTimeout(() => node.remove(), Math.round(1000 / speed));
}

/** 짧은 느린 화면 — 무대 안 애니메이션(도트 연출·피격 흔들림·파편)의 재생 속도를 잠시 0.3배로. */
function slowMotion(stage: HTMLElement, ms: number): void {
  if (typeof stage.getAnimations !== "function") return;
  const slowed = stage.getAnimations({ subtree: true }).filter((animation) => animation.playbackRate === 1);
  for (const animation of slowed) animation.playbackRate = 0.3;
  stage.dataset.comboSlowMo = "true";
  window.setTimeout(() => {
    for (const animation of slowed) if (animation.playbackRate === 0.3) animation.playbackRate = 1;
    delete stage.dataset.comboSlowMo;
  }, ms);
}
