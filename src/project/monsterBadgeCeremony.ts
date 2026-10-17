// project/monsterBadgeCeremony.ts
// 체육관 클리어 → 「배지 획득」 연출 레시피 (원작식: 관장 대사 → 섬광 → 징글 → 배지가 떠오르며 빛남 → 「○○ 배지를 받았다!」).
//
// 새 런타임 개념이 아니다. 기존 이벤트 명령(화면 플래시·ME/SE·그림 표시·파티클·대사)만 조립한 명령 배열이고,
// 그림은 기존 번들 아이콘(cc0-jetrel-*, 32px)을 그림 표시(showPicture)로 키워 쓴다 — 새 도트를 그리지 않는다.
// build_monster_game 의 모든 관장 승리 분기(world.ts)와 조수의 configure_monster_campaign {badgeCeremony}
// (gameSystemAuthoringTools.ts)가 같은 함수를 부른다 — 연출 모양이 한 곳에서만 정해진다.
//
// 배지 스위치 규칙(진행 게이팅의 정본 — openwiki/monster-campaign-menu.md 「배지 획득 연출과 배지 스위치 규칙」):
//   배지 N 의 스위치 id 는 `mx_badge_N`(1부터), 캠페인 정의 `system.monsterCampaign.badges[i].switchId` 가 정본이다.
//   이 연출은 스위치를 켜지 않는다 — 켜는 것은 관장전의 승리 스위치(battle() 의 winSwitch)이고, 연출은 그 뒤에 온다.
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import type { Command, Project } from "@/project/types";

/** 연출이 쓰는 그림 번호. 같은 것을 다시 부르면(재호출) 같은 슬롯을 덮어쓰고, 끝에 치운다. 끝 숫자가 없어 층 순서는 부른 순서다. */
export const BADGE_MEDAL_PICTURE_ID = "mx_badge_medal";
export const BADGE_HALO_PICTURE_ID = "mx_badge_halo";

/** 체육관 타입 → 번들 아이콘(cc0-jetrel-*). 없는 타입은 기본 배지 아이콘. */
const ICON_BY_TYPE: Readonly<Record<string, string>> = {
  grass: "cc0-jetrel-gen-gem-emerald",
  bug: "cc0-jetrel-gen-gem-emerald",
  water: "cc0-jetrel-gen-gem-sapphire",
  fire: "cc0-jetrel-gen-gem-ruby",
  psychic: "cc0-jetrel-gen-orb-mana",
  electric: "cc0-jetrel-gen-amulet-sun",
  fighting: "cc0-jetrel-gen-badge-guard",
  ground: "cc0-jetrel-gen-badge-guard",
  rock: "cc0-jetrel-gen-badge-guard",
  normal: "cc0-jetrel-badge",
  ice: "cc0-jetrel-crystal",
  ghost: "cc0-jetrel-gen-amulet-moon",
  dark: "cc0-jetrel-gen-amulet-moon",
  poison: "cc0-jetrel-gen-amulet-moon",
  dragon: "cc0-jetrel-gen-amulet-sun",
  steel: "cc0-jetrel-gen-badge-guard",
  flying: "cc0-jetrel-gen-amulet-sun",
  fairy: "cc0-jetrel-gen-brooch-rose",
};
const DEFAULT_ICON = "cc0-jetrel-badge";

/** 체육관 타입에 어울리는 배지 아이콘 id. */
export function badgeIconResourceId(type: string | undefined): string {
  return (type && ICON_BY_TYPE[type]) || DEFAULT_ICON;
}

export interface BadgeCeremonyOptions {
  /** 「새잎 배지」 — 「○○를 받았다!」 문장에 그대로 들어간다. */
  readonly badgeName: string;
  /** 이 배지가 몇 번째인가(1부터)와 전체 수 — 「3/8」 문장. 둘 다 있을 때만 말한다. */
  readonly badgeIndex?: number;
  readonly badgeTotal?: number;
  /** 체육관 타입(아이콘 선택). */
  readonly type?: string;
  /** 아이콘을 직접 고를 때(번들 아이콘·그림 리소스 id). type 보다 앞선다. */
  readonly iconResourceId?: string;
  /** 징글(ME). 생략 = 쓰지 않음. 몬스터 원정 프로젝트는 mx_audio_victory. */
  readonly fanfareResourceId?: string;
  /** 반짝임 효과음. 기본: 번들 보석 효과음. 빈 문자열이면 쓰지 않는다. */
  readonly sparkleSeResourceId?: string;
  /** 화면(게임 해상도). 기본 480×320(몬스터 원정 화면). 그림 위치를 가운데에 맞추는 데 쓴다. */
  readonly screen?: { readonly width: number; readonly height: number };
  /** 마지막 문장을 바꿀 때(기본 「○○를 받았다!」). */
  readonly line?: string;
}

const ICON_PX = 32;
const MEDAL_SCALE = 400; // 32px → 128px
const HALO_SCALE = 640;

const m2 = (commandId: string, fields: Record<string, string | number | boolean>): Command => ({ kind: "m2Command", commandId, fields });
// 대사 상자는 아래에 고정한다 — 자동(auto)이면 주인공을 피해 위로 올라가 떠오른 배지를 덮는다(2026-10-16 캡처).
const text = (body: string): Command => ({ kind: "text", body, position: "bottom" });
const withJosa = (name: string): string => {
  const last = name.trim().charCodeAt(name.trim().length - 1);
  // 한글 음절이면 받침 유무로 을/를, 아니면 「를」.
  if (last >= 0xac00 && last <= 0xd7a3) return `${name}${(last - 0xac00) % 28 === 0 ? "를" : "을"}`;
  return `${name}를`;
};

/**
 * 배지 획득 연출 명령 배열. 승리 분기에서 승리 스위치(배지 스위치)를 켠 **뒤**, 보상 지급 **앞**에 끼운다.
 * 연출 동안 그림 둘(medal·halo)을 띄우고 마지막에 치운다. 대사 상자는 그림 위에 겹쳐 뜬다.
 */
export function badgeAwardCommands(options: BadgeCeremonyOptions): Command[] {
  const screen = options.screen ?? { width: 480, height: 320 };
  const icon = options.iconResourceId?.trim() || badgeIconResourceId(options.type);
  const centerX = Math.round(screen.width / 2);
  // 대사 상자는 화면 아래쪽 — 배지는 위쪽 절반에 띄운다.
  const centerY = Math.round(screen.height * 0.36);
  const at = (scale: number, lift = 0) => {
    const size = (ICON_PX * scale) / 100;
    return { x: Math.round(centerX - size / 2), y: Math.round(centerY - size / 2 + lift) };
  };
  const medalFrom = at(MEDAL_SCALE, 40);
  const medalTo = at(MEDAL_SCALE);
  const halo = at(HALO_SCALE);
  const sparkle = options.sparkleSeResourceId === undefined ? "cc0-se-ors-item-gem-02" : options.sparkleSeResourceId;
  const cue = options.badgeIndex !== undefined && options.badgeTotal !== undefined
    ? [text(`배지 케이스에 ${options.badgeIndex}/${options.badgeTotal}번째 배지가 채워졌다.`)] : [];
  return [
    m2("m2-047-flash-screen", { color: "white", value: "flash", durationMs: 350 }),
    ...(options.fanfareResourceId ? [{ kind: "playAudio", resourceId: options.fanfareResourceId, loop: false, channel: "me" } as Command] : []),
    ...(sparkle ? [{ kind: "playAudio", resourceId: sparkle, loop: false, channel: "se" } as Command] : []),
    // 빛 번짐(더하기 합성) — 처음엔 투명으로 깔아 두고, 배지가 다 떠오르면 번쩍 켰다가 가라앉는다.
    { kind: "showPicture", pictureId: BADGE_HALO_PICTURE_ID, resourceId: icon, x: halo.x, y: halo.y, scale: HALO_SCALE, opacity: 0, blendMode: "add" },
    { kind: "showPicture", pictureId: BADGE_MEDAL_PICTURE_ID, resourceId: icon, x: medalFrom.x, y: medalFrom.y, scale: MEDAL_SCALE, opacity: 0 },
    { kind: "showPicture", pictureId: BADGE_MEDAL_PICTURE_ID, resourceId: icon, x: medalTo.x, y: medalTo.y, scale: MEDAL_SCALE, opacity: 255, durationMs: 900, easing: "easeOut", waitForPicture: true },
    m2("m2-224-particle-effect", { preset: "sparkle", target: "player", x: 0, y: 0, eventId: "", durationMs: 1800, wait: false }),
    { kind: "showPicture", pictureId: BADGE_HALO_PICTURE_ID, resourceId: icon, x: halo.x, y: halo.y, scale: HALO_SCALE, opacity: 170, durationMs: 400, easing: "easeOut", blendMode: "add", waitForPicture: true },
    { kind: "showPicture", pictureId: BADGE_HALO_PICTURE_ID, resourceId: icon, x: halo.x, y: halo.y, scale: HALO_SCALE, opacity: 45, durationMs: 800, easing: "easeInOut", blendMode: "add", waitForPicture: true },
    text(options.line?.trim() || `${withJosa(options.badgeName)} 받았다!`),
    ...cue,
    { kind: "erasePicture", pictureId: BADGE_MEDAL_PICTURE_ID },
    { kind: "erasePicture", pictureId: BADGE_HALO_PICTURE_ID },
  ];
}

/** 이 명령이 배지 연출의 그림을 띄우는가 — 이미 연출이 들어 있는지(재호출 멱등) 알아볼 때. */
export function isBadgeCeremonyCommand(command: Command): boolean {
  return (command.kind === "showPicture" || command.kind === "erasePicture")
    && (command.pictureId === BADGE_MEDAL_PICTURE_ID || command.pictureId === BADGE_HALO_PICTURE_ID);
}

/** 프로젝트 화면 크기(없으면 320×240 클래식) — 도구가 레시피에 넘긴다. */
export function projectScreen(project: Pick<Project, "system">): { width: number; height: number } {
  const resolution = project.system.playResolution;
  return resolution ? { width: resolution.width, height: resolution.height } : { width: 320, height: 240 };
}

// ── 기존 게임에 연출 심기/걷기 (조수 도구 configure_monster_campaign {badgeCeremony}) ──────────────────────────

export interface BadgeCeremonyInstallResult {
  /** 연출을 새로 심었거나 갈아 끼운 배지 id. */
  readonly installed: string[];
  /** 연출을 걷어 낸 배지 id(remove:true). */
  readonly removed: string[];
  /** 그 배지의 스위치를 켜는 이벤트를 못 찾은 배지 — 관장 이벤트가 없으면 연출을 심을 곳이 없다. */
  readonly missing: string[];
}

const isFlash = (command: Command): boolean => command.kind === "m2Command" && command.commandId === "m2-047-flash-screen";
const isCueAudio = (command: Command): boolean => command.kind === "playAudio" && (command.channel === "me" || command.channel === "se");

/** 한 명령 목록 안의 연출 구간(앞쪽 섬광·징글·효과음 포함, 마지막 그림 치우기까지). 없으면 undefined. */
export function findBadgeCeremony(list: readonly Command[]): { readonly start: number; readonly end: number } | undefined {
  const first = list.findIndex(isBadgeCeremonyCommand);
  if (first < 0) return undefined;
  let end = first;
  list.forEach((command, index) => { if (isBadgeCeremonyCommand(command)) end = index; });
  let start = first;
  while (start > 0 && (isCueAudio(list[start - 1]!) || isFlash(list[start - 1]!))) start -= 1;
  return { start, end };
}

function eachCommandList(project: Project, visit: (list: Command[]) => void): void {
  const walk = (list: Command[]): void => {
    visit(list);
    for (const command of list) for (const nested of nestedCommandLists(command)) walk(nested as Command[]);
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      walk(event.commands);
      for (const page of event.pages ?? []) walk(page.commands);
    }
  }
  for (const common of project.commonEvents ?? []) walk(common.commands);
}

/**
 * 캠페인 배지마다 그 스위치를 켜는 명령(승리 분기의 setSwitch) 바로 뒤에 배지 연출을 심는다 — 이미 있으면 새 이름·아이콘으로 갈아 끼운다(멱등).
 * badgeId 를 주면 그 배지만. remove:true 면 연출만 걷어 낸다(스위치·보상은 그대로).
 * 스위치를 켜는 이벤트가 없는 배지는 missing 으로 알린다 — 연출만 따로 심을 자리가 없다.
 */
export function installBadgeCeremonies(project: Project, options: { readonly badgeId?: string; readonly remove?: boolean; readonly line?: string } = {}): BadgeCeremonyInstallResult {
  const campaign = project.system.monsterCampaign;
  if (!campaign) throw new Error("몬스터 캠페인 정의가 없습니다.");
  const badges = campaign.badges.map((badge, index) => ({ badge, index })).filter(({ badge }) => options.badgeId === undefined || badge.id === options.badgeId);
  if (options.badgeId !== undefined && badges.length === 0) throw new Error(`없는 배지 id: ${options.badgeId} (배지: ${campaign.badges.map((b) => b.id).join(", ") || "없음"})`);
  const screen = projectScreen(project);
  const fanfare = project.system.battleVictoryMeResourceId;
  const result: { installed: string[]; removed: string[]; missing: string[] } = { installed: [], removed: [], missing: [] };
  for (const { badge, index } of badges) {
    let touched = false;
    eachCommandList(project, (list) => {
      const at = list.findIndex((command) => command.kind === "setSwitch" && command.switchId === badge.switchId && command.value !== false);
      if (at < 0) return;
      touched = true;
      const old = findBadgeCeremony(list);
      if (old) list.splice(old.start, old.end - old.start + 1);
      if (options.remove) return;
      const insertAt = list.findIndex((command) => command.kind === "setSwitch" && command.switchId === badge.switchId && command.value !== false) + 1;
      list.splice(insertAt, 0, ...badgeAwardCommands({
        badgeName: badge.name, badgeIndex: index + 1, badgeTotal: campaign.badges.length, iconResourceId: badge.iconResourceId,
        ...(fanfare ? { fanfareResourceId: fanfare } : {}), screen, ...(options.line ? { line: options.line } : {}),
      }));
    });
    if (!touched) result.missing.push(badge.id);
    else (options.remove ? result.removed : result.installed).push(badge.id);
  }
  return result;
}
