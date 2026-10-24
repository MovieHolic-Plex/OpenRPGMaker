/**
 * 연계기(듀얼·트리플 테크) 발동 연출 — 크로노 트리거처럼 「누구와 누구의 합체기인가」가 한눈에 보이게 한다(2026-10-24).
 *
 * - 무대 위 띠: 「연계!」 + 참가자 이름(×) + 기술 이름. 0.2초 미끄러져 들어와 1.3초 머문다.
 * - 참가자 전원(시전자 포함)이 빛을 두르고 한 번 뛰어오른다(`battle-combo-member`). 피해·위력 계산과 무관한 표시 전용이다.
 * - 소리: 짧은 상승 화음(합성, 에셋 없음).
 * 기술의 그림(도트 연출)은 기존 경로 그대로 retroChoreographyId·skillChoreographies 로 재생된다 — 이 모듈은 그 위에 얹힌다.
 */
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import { playBattleSfx } from "@/player/battleSfx";

const CUTIN_MS = 1500;
const MEMBER_MS = 1300;

export interface ComboCutInContext {
  readonly actorName: (recordId: string) => string;
  readonly skillName: (entry: BattleTimelineEntrySnapshot) => string;
  /** 연출 배속(빠르게 보기). 1 = 그대로. */
  readonly speed?: number;
}

/** 같은 행동의 엔트리가 여럿(대상 × 타수) 와도 한 번만 띄운다. 띄웠으면 true. */
export function playComboCutIn(root: HTMLElement, entry: BattleTimelineEntrySnapshot, context: ComboCutInContext): boolean {
  const members = entry.comboActorIds;
  if (!members || members.length < 2 || entry.side !== "actor") return false;
  const key = `${entry.actionId ?? entry.sequence}:${entry.skillId ?? ""}`;
  if (root.dataset.battleComboShown === key) return false;
  root.dataset.battleComboShown = key;
  const speed = context.speed && context.speed > 0 ? context.speed : 1;
  const stage = root.querySelector<HTMLElement>(".battle-field") ?? root;
  stage.querySelector(".battle-combo-cutin")?.remove();
  const ordered = entry.userRecordId ? [entry.userRecordId, ...members.filter((id) => id !== entry.userRecordId)] : [...members];
  const band = document.createElement("div");
  band.className = "battle-combo-cutin";
  band.dataset.testid = "battle-combo-cutin";
  band.dataset.members = String(ordered.length);
  band.style.setProperty("--combo-ms", `${Math.round(CUTIN_MS / speed)}ms`);
  const label = document.createElement("span");
  label.className = "battle-combo-cutin-label";
  label.textContent = ordered.length >= 3 ? "트리플 연계!" : "연계!";
  const names = document.createElement("span");
  names.className = "battle-combo-cutin-names";
  names.textContent = ordered.map((id) => context.actorName(id)).join(" × ");
  const skill = document.createElement("strong");
  skill.className = "battle-combo-cutin-skill";
  skill.textContent = context.skillName(entry);
  const sparks = document.createElement("span");
  sparks.className = "battle-combo-cutin-sparks";
  sparks.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 10; i += 1) {
    const spark = document.createElement("i");
    spark.style.setProperty("--spark-i", String(i));
    sparks.append(spark);
  }
  band.append(sparks, label, names, skill);
  stage.append(band);
  window.setTimeout(() => band.remove(), Math.round(CUTIN_MS / speed) + 120);
  // 참가자 전원 — 아군 노드 testid 는 battle-actor-<recordId>.
  ordered.forEach((recordId, index) => {
    const node = root.querySelector<HTMLElement>(`[data-testid="battle-actor-${CSS.escape(recordId)}"]`);
    if (!node) return;
    node.classList.remove("battle-combo-member");
    // 다시 걸기 위해 한 프레임 비운다(같은 사람이 연달아 연계기를 쓸 때).
    void node.offsetWidth;
    node.style.setProperty("--combo-delay", `${Math.round((index * 140) / speed)}ms`);
    node.style.setProperty("--combo-member-ms", `${Math.round(MEMBER_MS / speed)}ms`);
    node.classList.add("battle-combo-member");
    window.setTimeout(() => node.classList.remove("battle-combo-member"), Math.round((MEMBER_MS + index * 140) / speed) + 80);
  });
  playBattleSfx("combo");
  return true;
}
