/**
 * 전투 결과 팡파레 — 레벨 업 창의 배너·빛줄기·파티클, 「새 기술 습득!」 카드, 「새 연계기!」 카드(2026-10-24).
 *
 * 사용자: 「스킬을 배우거나 레벨업하면 화려하게 뭔가 뜨게 해야지」. 도트 결과 화면은 이미 한 사람씩 레벨 업 창을 넘긴다
 * (battleDirectorDom.advanceBattleResultLevelUps). 이 모듈은 그 창에 장식을 얹고, 같은 넘기기 줄에 카드를 더 끼운다 —
 * 확인키 한 번 = 창/카드 한 장. 켜기·끄기·세기·소리는 `system.battleFanfare`(project/battleFanfare.ts).
 */
import type { BattleSnapshot } from "@/battle/types";
import { comboActorIdsOf } from "@/battle/battleSkillUse";
import { skillHelp, skillHelpTagLine } from "@/battle/skillHelp";
import { resolveBattleFanfare, type ResolvedBattleFanfare } from "@/project/battleFanfare";
import type { Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";
import { playBattleSfx } from "@/player/battleSfx";

export function battleFanfareFor(project: Project): ResolvedBattleFanfare {
  return resolveBattleFanfare(project.system.battleFanfare);
}

/** 속성별 문장 색 — 카드 문장(紋章)과 빛줄기. 모르는 속성은 별빛 금색. */
const ELEMENT_TINT: Readonly<Record<string, string>> = {
  fire: "#ff7a3d", ice: "#7fe3ff", thunder: "#ffe14d", water: "#4fa8ff", wind: "#7dffb0", earth: "#c8955a",
  holy: "#fff2a8", dark: "#b47bff", poison: "#9be05a", sword: "#dfe7f2", spear: "#c2d2e8", bow: "#a6f08a", hit: "#ffb066",
};

/** 문장 글자 — 효과 종류로 고른다(그림 자산 없이도 기술 성격이 보이게). */
function emblemGlyph(skill: SkillRecord): string {
  if (comboActorIdsOf(skill)) return "✦";
  switch (skill.effect.kind) {
    case "healing": return "✚";
    case "support": return skill.stateEffects?.some((row) => row.operation === "remove") ? "❖" : "▲";
    case "damage": return skill.effect.statistic === "mind" ? "✷" : "⚔";
    default: return "★";
  }
}

export function skillEmblem(skill: SkillRecord, testId?: string): HTMLElement {
  const tint = (skill.elementId && ELEMENT_TINT[skill.elementId]) || "#ffd76a";
  return el("span", {
    class: "battle-learn-emblem",
    attrs: { "aria-hidden": "true", style: `--emblem-tint:${tint}` },
    dataset: { element: skill.elementId ?? "none", ...(testId ? { testid: testId } : {}) },
    children: [el("span", { class: "battle-learn-emblem-glyph", text: emblemGlyph(skill) })],
  });
}

/** 빛줄기·파티클 층 — style 이 burst 일 때만. 순수 장식(aria-hidden). */
export function fanfareBurst(tint: string): HTMLElement {
  const rays = el("span", { class: "battle-fanfare-rays", attrs: { "aria-hidden": "true" } });
  const sparks = el("span", { class: "battle-fanfare-sparks", attrs: { "aria-hidden": "true" } });
  for (let i = 0; i < 18; i += 1) {
    const spark = document.createElement("i");
    // 결정적 배치 — 같은 화면이 매번 같게 보인다(녹화 비교).
    spark.style.setProperty("--spark-x", `${((i * 37) % 100) - 50}`);
    spark.style.setProperty("--spark-d", `${(i * 53) % 400}ms`);
    spark.style.setProperty("--spark-s", `${0.6 + ((i * 29) % 10) / 10}`);
    sparks.append(spark);
  }
  return el("span", {
    class: "battle-fanfare-burst",
    attrs: { "aria-hidden": "true", style: `--fanfare-tint:${tint}` },
    children: [rays, sparks],
  });
}

/** 레벨 업 창 머리에 거는 큰 「LEVEL UP!」 배너. */
export function levelUpBanner(fanfare: ResolvedBattleFanfare): HTMLElement {
  return el("div", {
    class: "battle-levelup-banner",
    dataset: { testid: "battle-levelup-banner", style: fanfare.style },
    children: [
      ...(fanfare.style === "burst" ? [fanfareBurst("#ffe68a")] : []),
      el("span", { class: "battle-levelup-banner-text", text: "LEVEL UP!" }),
    ],
  });
}

/** 「새 기술 습득!」 카드 한 장 — 넘기기 줄에서 레벨 업 창 다음에 선다. */
export function skillLearnedCard(
  project: Project,
  actorName: string,
  actorId: string,
  skill: SkillRecord,
  fanfare: ResolvedBattleFanfare,
  kind: "skill" | "combo",
  comboNames?: readonly string[],
): HTMLElement {
  const help = skillHelp(project, skill);
  const tint = (skill.elementId && ELEMENT_TINT[skill.elementId]) || "#ffd76a";
  return el("article", {
    class: `battle-result-levelup battle-learn-card${kind === "combo" ? " is-combo" : ""}`,
    attrs: { "aria-label": `${actorName} ${kind === "combo" ? "새 연계기" : "새 기술"} ${skill.name}`, style: `--emblem-tint:${tint}` },
    dataset: { testid: `battle-learn-card-${actorId}-${skill.id}`, active: "false", fanfareKind: kind === "combo" ? "combo" : "skill", style: fanfare.style },
    children: [
      ...(fanfare.style === "burst" ? [fanfareBurst(tint)] : []),
      el("div", { class: "battle-learn-card-kicker", text: kind === "combo" ? "새 연계기!" : "새 기술 습득!" }),
      el("div", {
        class: "battle-learn-card-body",
        children: [
          skillEmblem(skill, `battle-learn-emblem-${skill.id}`),
          el("div", {
            class: "battle-learn-card-text",
            children: [
              el("span", { class: "battle-learn-card-who", text: kind === "combo" && comboNames ? comboNames.join(" × ") : actorName }),
              el("strong", { class: "battle-learn-card-name", text: skill.name }),
              el("span", { class: "battle-learn-card-cost", text: help.cost }),
            ],
          }),
        ],
      }),
      el("div", { class: "battle-learn-card-tags", text: skillHelpTagLine(help) }),
      ...(help.description ? [el("p", { class: "battle-learn-card-description", text: help.description })] : []),
      el("span", { class: "battle-result-levelup-page", text: "▼" }),
    ],
  });
}

/**
 * 이번 결과로 새로 열린 연계기 — 해금 조건(comboRequires) 중 하나가 이번에 배운 기술이고, 조건이 전부 채워졌고,
 * 참가자가 모두 이번 전투 파티에 있는 것. 레벨 업 창을 넘길 때 함께 띄운다.
 */
export function newlyUnlockedCombos(project: Project, snapshot: BattleSnapshot): Array<{ readonly skill: SkillRecord; readonly unlockedBy: string }> {
  const learned = new Map<string, Set<string>>();
  for (const actor of snapshot.actors) learned.set(actor.recordId, new Set([...actor.skillIds, ...(actor.equipmentEffects?.grantedSkillIds ?? [])]));
  const fresh = new Set<string>();
  for (const entry of snapshot.rewards.levelUps ?? []) {
    const known = learned.get(entry.actorId) ?? new Set<string>();
    for (const skillId of entry.learnedSkillIds) { known.add(skillId); fresh.add(`${entry.actorId}:${skillId}`); }
    learned.set(entry.actorId, known);
  }
  for (const tech of snapshot.rewards.techLearned ?? []) {
    const known = learned.get(tech.actorId) ?? new Set<string>();
    for (const skillId of tech.skillIds) { known.add(skillId); fresh.add(`${tech.actorId}:${skillId}`); }
    learned.set(tech.actorId, known);
  }
  const out: Array<{ skill: SkillRecord; unlockedBy: string }> = [];
  for (const skill of project.database.skills) {
    const combo = comboActorIdsOf(skill);
    const requires = skill.comboRequires ?? [];
    if (!combo || requires.length === 0) continue;
    if (!combo.every((id) => learned.has(id))) continue;
    const trigger = requires.find((row) => fresh.has(`${row.actorId}:${row.skillId}`));
    if (!trigger) continue;
    if (!requires.every((row) => learned.get(row.actorId)?.has(row.skillId))) continue;
    out.push({ skill, unlockedBy: trigger.actorId });
  }
  return out;
}

/** 창/카드가 열리는 순간의 소리. */
export function playFanfareCue(windowNode: HTMLElement, fanfare: ResolvedBattleFanfare): void {
  if (!fanfare.sound) return;
  const kind = windowNode.dataset.fanfareKind;
  if (kind === "skill" || kind === "combo") playBattleSfx(kind === "combo" ? "combo" : "skillLearned");
  else if (kind === "levelUp") playBattleSfx("levelUp");
}
