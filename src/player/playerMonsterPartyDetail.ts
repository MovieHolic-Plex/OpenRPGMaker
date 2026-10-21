import { MONSTER_NICKNAME_MAX, monsterGenderLabel } from "@/project/monsterIdentity";
import { abilityEffectText } from "@/battle/abilities";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { captureConditionLabel } from "@/battle/captureBalls";
import { heldEffectText } from "@/battle/heldItems";
import { MONSTER_PARTY_MAX } from "@/project/monsterCollection";
import { monsterNatureById, monsterNatureEffectText, monsterStatRulesOf } from "@/project/monsterStatRules";
import { monsterBoxUnavailableReason, monsterMoveDescription, monsterPartyEntries, monsterMenuIconResourceId, monsterTypeLabel, monsterUiEntry } from "@/player/playerMonsterPartyModel";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { MONSTER_SUMMARY_PAGES, MONSTER_SUMMARY_PAGE_LABEL, nextMonsterSummaryPage } from "@/player/playerMonsterCollectTypes";

const readOnly = () => undefined;

export function monsterKnownMoveEntries(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry[] {
  const instance = options.session.monsterInstances[instanceId];
  if (!instance) return [];
  const entry = monsterUiEntry(options.project, instance);
  return (entry.instance.skillIds ?? []).map(id => {
    const skill = options.project.database.skills.find(record => record.id === id);
    const max = skill?.maxPp;
    // 필드 기술(절단·파도타기 같은 비전머신)은 고르면 바로 쓴다 — 배우 스킬 목록의 필드 능력과 같은 동작.
    const field = Boolean(skill?.fieldCommonEventId) && Boolean(options.onUseMonsterFieldSkill);
    return { label: skill?.name ?? id, value: field ? "필드에서 사용" : max === undefined ? "PP —" : `PP ${entry.instance.skillPp?.[id] ?? max}/${max}`,
      // 필드 기술은 위력·성공률·분류 줄이 의미 없고 설명 칸(한 줄 반)을 넘겨 잘렸다(2026-10-16 원본 해상도 캡처) — 한 문장만.
      description: skill?.fieldCommonEventId
        ? "필드 기술 — Enter 로 바라보는 앞에 쓴다"
        : [monsterTypeLabel(options.project, skill?.elementId ? [skill.elementId] : []),
          skill ? `위력 ${skill.power} · 성공 ${skill.successRate}%` : "", monsterMoveDescription(options.project, skill?.description)].filter(Boolean).join(" · "),
      testId: `status-menu-monster-known-skill-${instanceId}-${id}`, onActivate: field ? () => options.onUseMonsterFieldSkill?.(instanceId, id) : readOnly };
  });
}

export function monsterPartyStatusDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  return { title: "상태: 몬스터 파티", entries: monsterPartyEntries(options.project, options.session).map(entry => ({
    label: entry.name, value: `Lv.${entry.instance.level}`, description: `${entry.typeLabel} · HP ${entry.hp}/${entry.maxHp} · ${entry.stateNames.join(" · ") || "정상"}`,
    icon: { resourceId: monsterMenuIconResourceId(options.project, entry.species?.graphic.monsterResourceId), alt: entry.name, testId: `status-menu-monster-art-${entry.instance.instanceId}` },
    testId: `status-menu-monster-${entry.instance.instanceId}`, onActivate: () => options.onSelectMonster?.(entry.instance.instanceId),
  })), emptyLabel: "파티 몬스터가 없습니다", hint: "Enter 현재 능력·기술 보기" };
}

export function monsterPartySkillDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  if (options.skillActorId) {
    const instance = options.session.monsterInstances[options.skillActorId];
    if (!instance || !options.session.monsterParty.includes(instance.instanceId)) return { title: "몬스터 기술", entries: [], emptyLabel: "파티 몬스터를 찾을 수 없습니다" };
    const entry = monsterUiEntry(options.project, instance);
    return { title: `기술: ${entry.name}`, entries: monsterKnownMoveEntries(options, instance.instanceId), emptyLabel: "배운 기술이 없습니다", hint: "현재 PP · Enter 기술 설명 · Esc 몬스터 목록" };
  }
  return { title: "몬스터 기술", entries: monsterPartyEntries(options.project, options.session).map(entry => ({
    label: entry.name, value: `Lv.${entry.instance.level}`, description: `HP ${entry.hp}/${entry.maxHp} · 기술 ${entry.instance.skillIds?.length ?? 0}개`,
    testId: `status-menu-skill-actor-${entry.instance.instanceId}`, onActivate: () => options.onSelectSkillActor?.(entry.instance.instanceId),
    icon: { resourceId: monsterMenuIconResourceId(options.project, entry.species?.graphic.monsterResourceId), alt: entry.name, testId: `status-menu-skill-monster-art-${entry.instance.instanceId}` },
  })), emptyLabel: "파티 몬스터가 없습니다", hint: "Enter 보유 기술·현재 PP 보기" };
}

/** 「포획 볼」 줄 — 잡은 볼의 이름·등급·조건을 보인다(그림이 아니라 글자 ◓ + 이름: 볼 그림이 필요하면 아이템의 iconResourceId). 포획이 아닌 입수는 줄이 없다. */
function caughtBallEntries(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry[] {
  const ballId = options.session.monsterInstances[instanceId]?.caughtBallId;
  if (!ballId) return [];
  const item = options.project.database.items.find((record) => record.id === ballId);
  const profile = item?.captureProfile;
  const grade = profile?.ballClass === "master" ? "마스터 등급" : profile?.ballClass === "ultra" ? "울트라 등급" : profile?.ballClass === "great" ? "그레이트 등급" : "";
  const note = [grade, profile?.condition ? captureConditionLabel(profile.condition) : ""].filter(Boolean).join(" · ");
  return [{
    label: "포획 볼", value: `◓ ${item?.name ?? "알 수 없는 볼"}`,
    ...(note ? { description: note } : {}),
    testId: `status-menu-monster-ball-${instanceId}`,
    ...(item ? { icon: { resourceId: item.iconResourceId ?? item.imageResourceId, alt: item.name, testId: `status-menu-monster-ball-icon-${instanceId}` } } : {}),
    onActivate: readOnly,
  }];
}

/** 「성격」 줄 — system.monsterStatRules.natures 가 켜진 프로젝트에서만. 올리고 내리는 능력치를 같이 보인다. */
function natureEntries(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry[] {
  if (!monsterStatRulesOf(options.project).natures) return [];
  const nature = monsterNatureById(options.session.monsterInstances[instanceId]?.nature);
  if (!nature) return [];
  return [{ label: "성격", value: nature.name, description: monsterNatureEffectText(nature), testId: `status-menu-monster-nature-${instanceId}`, onActivate: readOnly }];
}

/** 「지닌 도구」 줄 — 지닌 도구와 효과를 보이고, 고르면(파티 몬스터만) 가방으로 되돌린다. */
function heldItemEntry(options: StatusMenuDetailOptions, instanceId: string): StatusMenuDetailEntry {
  const held = options.session.monsterInstances[instanceId]?.heldItemId;
  const item = held ? options.project.database.items.find((record) => record.id === held) : undefined;
  if (!item?.heldEffect) {
    return { label: "지닌 도구", value: "없음", description: "가방의 지닐 수 있는 도구를 고르면 이 몬스터에게 쥐여 줄 수 있습니다", testId: `status-menu-monster-held-${instanceId}`, onActivate: readOnly };
  }
  return {
    label: "지닌 도구", value: item.name,
    description: `${heldEffectText(item.heldEffect)} 선택하면 가방으로 되돌립니다.`,
    testId: `status-menu-monster-held-${instanceId}`,
    onActivate: () => options.onTakeHeldItem?.(instanceId),
  };
}

/** 쪽 나눔 화면의 정보 줄은 커서가 멈추지 않는다 — 읽기만 하는 줄을 ↑↓로 하나씩 지나가게 하지 않는다. */
function infoRow(paged: boolean, entry: StatusMenuDetailEntry): StatusMenuDetailEntry {
  return paged ? { ...entry, onActivate: undefined } : { ...entry, onActivate: readOnly };
}

export function monsterInstanceDetail(options: StatusMenuDetailOptions, pendingChoices: readonly StatusMenuDetailEntry[]): StatusMenuDetail | undefined {
  const instanceId = options.monsterInstanceId;
  const view = options.monsterView ?? "party";
  const ids = view === "party" ? options.session.monsterParty : options.session.monsterBox;
  const raw = instanceId && ids.includes(instanceId) ? options.session.monsterInstances[instanceId] : undefined;
  if (!raw) return undefined;
  const entry = monsterUiEntry(options.project, raw);
  const artwork = resolveAssetResourceUrl(entry.species?.graphic.monsterResourceId, { project: options.project });
  const target = view === "party" ? "box" : "party";
  const reason = target === "box" ? monsterBoxUnavailableReason(options.project, options.session, raw.instanceId)
    : options.session.monsterParty.length >= MONSTER_PARTY_MAX ? "파티가 가득 찼습니다" : undefined;
  // 쪽 나눔은 에메랄드 요약 화면(480×320 한 장)에서만 쓴다 — 다른 스킨은 기존처럼 한 목록에 모두 둔다.
  const page = isEmeraldMonsterStyle(options.project) && options.onMonsterCollect ? options.monsterCollect?.summaryPage ?? "stats" : undefined;
  const paged = page !== undefined;
  const showGenderRow = Boolean(raw.gender) && entry.stateNames.length === 0 && paged;
  const info: StatusMenuDetailEntry[] = [
    infoRow(paged, { label: "타입", value: entry.typeLabel, attributes: { "data-summary-half": "true" } }),
    // 쪽 한 장에는 반쪽 줄이 짝으로 들어간다 — 상태가 정상이면 성별이 그 자리를 쓰고, 상태 이상이면 상태가 먼저다(성별은 목록에서 보인다).
    ...(showGenderRow
      ? [infoRow(paged, { label: "성별", value: monsterGenderLabel(raw), testId: "status-menu-monster-gender", attributes: { "data-summary-half": "true" } })]
      : [infoRow(paged, { label: "상태", value: entry.stateNames.join(" · ") || "정상", attributes: { "data-summary-half": "true" } })]),
    // 성격은 특성 줄처럼 커서가 멈추고, 올리고 내리는 능력치는 아래 안내 창이 읽어 준다(반줄에 넣으면 설명이 다른 줄 위로 겹친다).
    ...natureEntries(options, raw.instanceId),
    ...caughtBallEntries(options, raw.instanceId).map((row) => infoRow(paged, row)),
    // 특성은 효과 설명이 길어 줄 안에 못 담는다 — 커서가 멈추게 두고 설명은 아래 안내 창이 읽어 준다.
    ...(entry.species?.ability ? [{ label: "특성", value: entry.species.ability.name, description: abilityEffectText(entry.species.ability, (id) => monsterTypeLabel(options.project, [id]) || id), testId: "status-menu-monster-ability", onActivate: readOnly }] : []),
  ];
  const stats: StatusMenuDetailEntry[] = [
    infoRow(paged, { label: "HP", value: `${entry.hp}/${entry.maxHp}`, testId: "status-menu-monster-current-hp", ...(paged ? { attributes: { "data-summary-half": "true" } } : {}) }),
    ...(paged ? [infoRow(paged, { label: "레벨업", value: entry.nextLevel ? `${entry.nextLevel.remaining} EXP` : "최대", testId: "status-menu-monster-next-level", attributes: { "data-summary-half": "true" } })] : []),
    infoRow(paged, { label: "공격", value: String(entry.stats.attack), testId: "status-menu-monster-current-stats", attributes: { "data-summary-half": "true" } }),
    infoRow(paged, { label: "방어", value: String(entry.stats.defense), attributes: { "data-summary-half": "true" } }),
    infoRow(paged, { label: "특공", value: String(entry.stats.mind), attributes: { "data-summary-half": "true" } }),
    infoRow(paged, { label: "속도", value: String(entry.stats.agility), attributes: { "data-summary-half": "true" } }),
  ];
  const moves: StatusMenuDetailEntry[] = [...monsterKnownMoveEntries(options, raw.instanceId), ...pendingChoices];
  const moveEntry: StatusMenuDetailEntry = { label: target === "box" ? "보관함으로 이동" : "파티로 이동", value: reason ? "이동 불가" : "", description: reason ?? "선택하면 이 몬스터를 이동합니다", unavailableReason: reason,
    testId: `status-menu-monster-move-${raw.instanceId}`, onActivate: () => options.onMoveMonster?.(raw.instanceId, target) };
  const swappable = view === "party" && options.session.monsterParty.length > 1 && Boolean(options.onMonsterCollect);
  const swapEntry: StatusMenuDetailEntry[] = swappable ? [{
    label: "자리 바꾸기", value: "", description: "파티에서 맞바꿀 동료를 고릅니다. 맨 앞 동료가 먼저 나갑니다.",
    testId: `status-menu-monster-swap-${raw.instanceId}`, onActivate: () => options.onMonsterCollect?.({ kind: "startSwap", instanceId: raw.instanceId }),
  }] : [];
  const inBox = view === "box" && Boolean(options.onMonsterCollect) && options.session.monsterBox.includes(raw.instanceId);
  const askRelease = options.monsterCollect?.releaseConfirmId === raw.instanceId;
  const boxEntries: StatusMenuDetailEntry[] = inBox ? [
    { label: "다른 칸으로 옮기기", value: "", description: "보관함에서 옮길 칸을 고릅니다. 다른 상자의 칸도 됩니다.",
      testId: `status-menu-monster-boxmove-${raw.instanceId}`, onActivate: () => options.onMonsterCollect?.({ kind: "startBoxMove", instanceId: raw.instanceId }) },
    { label: askRelease ? "정말 놓아주기?" : "놓아주기", value: askRelease ? "한 번 더" : "",
      description: askRelease ? "한 번 더 선택하면 되돌릴 수 없습니다. Esc 취소" : "자연으로 돌려보냅니다. 지닌 도구는 가방으로 돌아옵니다.",
      testId: `status-menu-monster-release-${raw.instanceId}`,
      onActivate: () => options.onMonsterCollect?.(askRelease ? { kind: "release", instanceId: raw.instanceId } : { kind: "releaseAsk", instanceId: raw.instanceId }) },
  ] : [];
  const renaming = options.monsterCollect?.renameId === raw.instanceId;
  const renameEntry: StatusMenuDetailEntry[] = renaming ? [{
    label: "별명", value: "", testId: `status-menu-monster-rename-${raw.instanceId}`, attributes: { monsterRename: "true" },
    textInput: {
      label: "별명", value: raw.nickname ?? "", maxLength: MONSTER_NICKNAME_MAX,
      onCommit: (name) => options.onMonsterCollect?.({ kind: "rename", instanceId: raw.instanceId, name }),
      onCancel: () => options.onMonsterCollect?.({ kind: "cancelRename" }),
    },
  }] : options.onMonsterCollect ? [{
    label: "별명 바꾸기", value: raw.nickname ?? "—", description: `최대 ${MONSTER_NICKNAME_MAX}글자. 비우면 종 이름으로 돌아갑니다`,
    testId: `status-menu-monster-rename-${raw.instanceId}`, onActivate: () => options.onMonsterCollect?.({ kind: "startRename", instanceId: raw.instanceId }),
  }] : [];
  const back: StatusMenuDetailEntry = { label: inBox ? "← 보관함" : "← 몬스터 목록", value: "", testId: "status-menu-monster-back", onActivate: () => options.onSelectMonster?.(undefined) };
  const cycle: StatusMenuDetailEntry[] = page ? [{
    label: `${MONSTER_SUMMARY_PAGE_LABEL[page]} ▶ ${MONSTER_SUMMARY_PAGE_LABEL[nextMonsterSummaryPage(page)]}`, value: `${MONSTER_SUMMARY_PAGES.indexOf(page) + 1}/${MONSTER_SUMMARY_PAGES.length}`,
    description: "선택하면 다음 쪽으로 넘어갑니다",
    testId: "status-menu-monster-page", attributes: { "data-summary-page": page },
    onActivate: () => options.onMonsterCollect?.({ kind: "summaryPage", page: nextMonsterSummaryPage(page) }),
  }] : [];
  const entries: StatusMenuDetailEntry[] = page === undefined
    ? [back, ...info, ...stats, ...moves, heldItemEntry(options, raw.instanceId), moveEntry]
    : page === "stats" ? [back, ...cycle, ...info, ...stats]
    : page === "moves" ? [back, ...cycle, ...moves]
    : [back, ...cycle, ...renameEntry, heldItemEntry(options, raw.instanceId), ...swapEntry, moveEntry, ...boxEntries];
  return { title: `${raw.shiny ? "★ " : ""}${entry.name} · Lv.${raw.level}`, layout: isEmeraldMonsterStyle(options.project) ? "campaign-summary" : "campaign-dex", artwork: artwork ? { src: artwork, alt: entry.name, ...(raw.shiny ? { shiny: true } : {}) } : undefined,
    entries, hint: inBox ? "↑↓ 항목 확인 · Esc 보관함" : "↑↓ 항목 확인 · Esc 몬스터 목록" };
}
