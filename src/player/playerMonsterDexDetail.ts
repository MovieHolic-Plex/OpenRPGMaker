// 몬스터 도감(목록·상세) 상세 빌더. 원정 정의(monsterCampaign)가 있으면 그 목록·노트를,
// 없으면 수집 게임의 종 레코드 전부와 종의 dexNote 를 쓴다(project/monsterJournal.monsterDexSpeciesIds).
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { MONSTER_DEX_PAGE_LABEL, MONSTER_DEX_PAGES, nextMonsterDexPage, type MonsterDexPage } from "@/player/playerMonsterDexTypes";
import { monsterMenuIconResourceId, monsterMoveDescription, monsterTypeLabel } from "@/player/playerMonsterPartyModel";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import type { MonsterSpeciesRecord } from "@/project/types";
import { monsterDexNote, monsterDexSpeciesIds, monsterJournalEntry, monsterSpeciesHabitats } from "@/project/monsterJournal";

const readOnly = (): void => {};
const HABITAT_SHOWN = 2;

/** 기록 줄이 한 줄로 읽히도록 만나는 곳은 셋까지만 이름을 적고 나머지는 개수로 접는다. */
export function habitatSummary(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length <= HABITAT_SHOWN) return names.join(" · ");
  return `${names.slice(0, HABITAT_SHOWN).join(" · ")} 외 ${names.length - HABITAT_SHOWN}곳`;
}

function infoEntries(entries: readonly StatusMenuDetailEntry[]): StatusMenuDetailEntry[] {
  return entries.map((entry) => ({ ...entry, onActivate: entry.onActivate ?? readOnly,
    attributes: { ...entry.attributes, "data-campaign-information": "true" } }));
}

export function dexDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const ids = monsterDexSpeciesIds(project);
  const selected = options.campaignSpeciesId;
  const species = selected && ids.includes(selected)
    ? project.database.monsterSpecies?.find((record) => record.id === selected) : undefined;
  if (species && monsterJournalEntry(session, species.id).seen) return speciesPage(options, species, ids);
  const receipts = ids.map((id) => monsterJournalEntry(session, id));
  const seenCount = receipts.filter((entry) => entry.seen).length;
  const caughtCount = receipts.filter((entry) => entry.caught).length;
  return {
    title: `몬스터 도감 · 발견 ${seenCount}/${ids.length} · 포획 ${caughtCount}`,
    layout: "campaign-dex",
    meter: { seen: seenCount, caught: caughtCount, total: ids.length },
    entries: ids.map((speciesId, index) => {
      const record = project.database.monsterSpecies?.find((entry) => entry.id === speciesId);
      const receipt = receipts[index]!;
      return {
        label: `${String(index + 1).padStart(3, "0")} ${receipt.seen ? record?.name ?? "???" : "???"}`,
        value: receipt.caught ? "◆ 포획" : receipt.seen ? "◇ 발견" : "—",
        description: receipt.seen ? monsterDexNote(project, speciesId) ?? "생태 기록 보기" : "아직 만나지 못한 몬스터입니다.",
        icon: receipt.seen && record?.graphic.monsterResourceId ? { resourceId: monsterMenuIconResourceId(project, record.graphic.monsterResourceId), alt: record.name, testId: `campaign-dex-art-${speciesId}` } : undefined,
        attributes: { "data-dex-seen": String(receipt.seen), "data-dex-caught": String(receipt.caught) },
        testId: `campaign-dex-${speciesId}`,
        onActivate: receipt.seen && options.onSelectCampaignSpecies
          ? () => options.onSelectCampaignSpecies?.(speciesId) : readOnly,
      };
    }),
    hint: "↑↓ 몬스터 선택 · Enter 생태·기술 · Esc 돌아가기",
  };
}

function speciesPage(options: StatusMenuDetailOptions, species: MonsterSpeciesRecord, ids: readonly string[]): StatusMenuDetail {
  const { project, session } = options;
  const receipt = monsterJournalEntry(session, species.id);
  const artwork = resolveAssetResourceUrl(species.graphic.monsterResourceId, { project });
  const paged = isEmeraldMonsterStyle(project) && options.onDexPage !== undefined;
  const page: MonsterDexPage = paged ? options.dexPage ?? "info" : "info";
  const half = (entry: StatusMenuDetailEntry): StatusMenuDetailEntry => ({ ...entry, attributes: { ...entry.attributes, "data-summary-half": "true" } });
  const habitats = monsterSpeciesHabitats(project, species.id);
  const note = monsterDexNote(project, species.id);
  const stats = species.baseStats;

  const back: StatusMenuDetailEntry = { label: "← 도감 목록", value: "", onActivate: () => options.onSelectCampaignSpecies?.(undefined), testId: "campaign-dex-back" };
  const cycle: StatusMenuDetailEntry[] = paged ? [{
    label: `${MONSTER_DEX_PAGE_LABEL[page]} ▶ ${MONSTER_DEX_PAGE_LABEL[nextMonsterDexPage(page)]}`,
    value: `${MONSTER_DEX_PAGES.indexOf(page) + 1}/${MONSTER_DEX_PAGES.length}`,
    testId: "campaign-dex-page", attributes: { "data-dex-page": page },
    onActivate: () => options.onDexPage?.(nextMonsterDexPage(page)),
  }] : [];

  const info: StatusMenuDetailEntry[] = infoEntries([
    half({ label: "기록", value: receipt.caught ? "포획" : "발견" }),
    half({ label: "타입", value: monsterTypeLabel(project, species.types) }),
    { label: "분포", value: "", description: `분포: ${habitats.length ? habitatSummary(habitats) : "야생에서는 만날 수 없음"}`, testId: `campaign-dex-habitat-${species.id}`, attributes: { "data-dex-block": "true", "data-dex-habitat": String(habitats.length) } },
    { label: "생태", value: "", description: note ?? "아직 생태 노트가 없습니다.", testId: `campaign-dex-note-${species.id}`, attributes: { "data-dex-block": "true" } },
  ]);
  const statRows: StatusMenuDetailEntry[] = infoEntries([
    half({ label: "HP", value: String(stats.maxHp) }),
    half({ label: "공격", value: String(stats.attack) }),
    half({ label: "방어", value: String(stats.defense) }),
    half({ label: "특공", value: String(stats.mind) }),
    half({ label: "속도", value: String(stats.agility) }),
    half({ label: "포획률", value: `${Math.round(species.captureRate * 100)}%` }),
  ]);
  // 진화·기술 줄은 커서가 올라가면 설명(조건·기술 효과)을 아래 설명창이 보여 준다 — 줄 안에 끼워 넣지 않는다.
  const evolutions: StatusMenuDetailEntry[] = (species.evolutions ?? []).map((evolution) => {
    const target = project.database.monsterSpecies?.find((record) => record.id === evolution.toSpeciesId);
    const known = monsterJournalEntry(session, evolution.toSpeciesId).seen;
    const item = project.database.items.find((record) => record.id === evolution.requires.itemId);
    const condition = [evolution.requires.level ? `Lv.${evolution.requires.level}` : "", item?.name,
      evolution.requires.friendshipAtLeast ? `친밀도 ${evolution.requires.friendshipAtLeast}` : ""].filter(Boolean).join(" + ");
    return { label: "진화", value: known ? target?.name ?? "???" : "???", description: condition || "진화 조건을 찾아보세요.", onActivate: readOnly };
  });
  const skills: StatusMenuDetailEntry[] = (species.skillsByLevel ?? []).map((entry) => {
    const skill = project.database.skills.find((record) => record.id === entry.skillId);
    return { label: `Lv.${entry.level} ${skill?.name ?? entry.skillId}`, value: skill ? `PP ${skill.maxPp ?? "—"}` : "", description: monsterMoveDescription(project, skill?.description), onActivate: readOnly };
  });

  const body = !paged ? [...info, ...statRows, ...evolutions, ...skills] : page === "info" ? info : page === "stats" ? [...statRows, ...evolutions] : skills;
  return {
    title: `No.${String(ids.indexOf(species.id) + 1).padStart(3, "0")} ${species.name}`,
    layout: "campaign-dex",
    artwork: artwork ? { src: artwork, alt: species.name } : undefined,
    entries: [back, ...cycle, ...body],
    hint: paged ? "↑↓ 보기 · Enter 쪽 넘기기 · Esc 도감 목록" : "↑↓ 기술 보기 · Esc 도감 목록",
  };
}
