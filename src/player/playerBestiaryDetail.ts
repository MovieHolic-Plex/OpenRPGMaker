// player/playerBestiaryDetail.ts
// ESC 메뉴 「도감」(괴물 도감, 일반 RPG) — 목록 → 상세. 상세는 몬스터 도감(playerMonsterDexDetail)과 같은 틀(campaign-dex)을 빌려
// 전투 그림을 크게, 열린 칸은 글, 잠긴 칸은 「???」와 여는 방법 한 줄. 약점 칸에는 전투에서 알아낸 약점이 붙는다.
// 규칙(잠김 판정·알아낸 약점)은 project/bestiary.ts.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { elementDisplayName } from "@/battle/skillHelp";
import {
  BESTIARY_UNLOCK_LABELS,
  bestiaryEntryDefeated,
  bestiaryEntryKnown,
  bestiaryKnownWeaknesses,
  bestiarySectionUnlocked,
  bestiaryTitle,
  resolveBestiary,
  type BestiaryEntry,
} from "@/project/bestiary";
import type { Project } from "@/project/types";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

const readOnly = (): void => {};
const LOCKED_HINT: Readonly<Record<string, string>> = {
  seen: "처음 만나면 열린다.",
  defeated: "쓰러뜨리면 열린다.",
  weakness: "약점을 찾아내면 열린다.",
  condition: "더 알아보면 열린다.",
};

/** 알아낸 약점·저항 한 줄. 예: 「화염 약점 ×2 · 물리 저항 ×0.5」. 모르면 빈 글자. */
export function bestiaryWeaknessLine(project: Project, known: Readonly<Record<string, number>>): string {
  const parts: string[] = [];
  for (const [key, rate] of Object.entries(known)) {
    const [kind, id = ""] = key.split(":");
    const name = kind === "element" ? elementDisplayName(project, id) : id === "magic" ? "마법" : "물리";
    const grade = rate <= 0 ? "무효" : rate > 1 ? "약점" : "저항";
    parts.push(rate <= 0 ? `${name} ${grade}` : `${name} ${grade} ×${Math.round(rate * 100) / 100}`);
  }
  return parts.join(" · ");
}

function entryPicture(project: Project, entry: BestiaryEntry): string | undefined {
  const resourceId = entry.pictureResourceId
    ?? entry.enemyIds.map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.monsterResourceId).find(Boolean);
  return resourceId ? resolveAssetResourceUrl(resourceId, { project }) ?? undefined : undefined;
}

export function bestiaryDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const config = resolveBestiary(project);
  const entries = config?.entries ?? [];
  const title = bestiaryTitle(project);
  const selected = options.bestiaryEntryId ? entries.find((entry) => entry.id === options.bestiaryEntryId) : undefined;
  if (selected && bestiaryEntryKnown(session, selected)) return entryPage(options, selected, title);
  const known = entries.filter((entry) => bestiaryEntryKnown(session, entry));
  const complete = known.filter((entry) => entry.sections.every((section) => bestiarySectionUnlocked(session, entry, section)));
  return {
    title: `${title} · ${known.length}/${entries.length}`,
    layout: "campaign-dex",
    meter: { seen: known.length, caught: complete.length, total: entries.length },
    emptyLabel: "아직 적힌 괴물이 없습니다",
    entries: entries.map((entry, index) => {
      const isKnown = bestiaryEntryKnown(session, entry);
      const open = entry.sections.filter((section) => bestiarySectionUnlocked(session, entry, section)).length;
      return {
        label: `${String(index + 1).padStart(2, "0")} ${isKnown ? entry.name : "???"}`,
        value: isKnown ? `${open}/${entry.sections.length}` : "—",
        description: isKnown ? `${open}칸 열림 · 결정으로 읽기` : "아직 만나지 못한 괴물입니다.",
        attributes: { "data-bestiary-known": String(isKnown), "data-bestiary-open": String(open) },
        testId: `status-menu-bestiary-${entry.id}`,
        onActivate: isKnown && options.onSelectBestiaryEntry ? () => options.onSelectBestiaryEntry?.(entry.id) : readOnly,
      };
    }),
    hint: "↑↓ 괴물 고르기 · Enter 읽기 · Esc 돌아가기",
  };
}

function entryPage(options: StatusMenuDetailOptions, entry: BestiaryEntry, title: string): StatusMenuDetail {
  const { project, session } = options;
  const picture = entryPicture(project, entry);
  const weaknesses = bestiaryWeaknessLine(project, bestiaryKnownWeaknesses(session, entry));
  const defeated = bestiaryEntryDefeated(session, entry);
  const back: StatusMenuDetailEntry = { label: `← ${title} 목록`, value: "", testId: "status-menu-bestiary-back", onActivate: () => options.onSelectBestiaryEntry?.(undefined) };
  const sections: StatusMenuDetailEntry[] = entry.sections.map((section) => {
    const unlocked = bestiarySectionUnlocked(session, entry, section);
    const unlock = section.unlock ?? "seen";
    const extra = unlocked && unlock === "weakness" && weaknesses ? `\n알아낸 것: ${weaknesses}` : "";
    return {
      label: unlocked ? section.title : "???",
      value: unlocked ? "" : "잠김",
      description: unlocked ? `${section.text}${extra}` : LOCKED_HINT[unlock] ?? BESTIARY_UNLOCK_LABELS[unlock],
      testId: `status-menu-bestiary-section-${section.id}`,
      attributes: { "data-bestiary-unlocked": String(unlocked), "data-bestiary-unlock": unlock, "data-campaign-information": "true", "data-dex-block": "true" },
      onActivate: readOnly,
    };
  });
  // 약점 칸이 없는 항목도 전투에서 알아낸 약점은 보인다 — 「알아낸 만큼 적힌다」는 약속.
  const hasWeaknessSection = entry.sections.some((section) => (section.unlock ?? "seen") === "weakness");
  const learned: StatusMenuDetailEntry[] = weaknesses && !hasWeaknessSection
    ? [{ label: "전투에서 알아낸 것", value: "", description: weaknesses, testId: "status-menu-bestiary-known-weakness", attributes: { "data-campaign-information": "true", "data-dex-block": "true" }, onActivate: readOnly }]
    : [];
  return {
    title: entry.name,
    layout: "campaign-dex",
    artwork: picture ? { src: picture, alt: entry.name } : undefined,
    entries: [
      back,
      { label: "쓰러뜨린 수", value: String(defeated), testId: "status-menu-bestiary-defeated", attributes: { "data-campaign-information": "true" }, onActivate: readOnly },
      ...sections,
      ...learned,
    ],
    hint: "↑↓ 읽기 · Esc 목록",
  };
}
