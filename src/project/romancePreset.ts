// project/romancePreset.ts
// 관계·연애 장르의 결정론 기본값(2026-10-16 연애 감사). 인터뷰가 연애(주 장르)로 시작한 프로젝트에만 한 번 깐다.
// 전부 옵트인 필드이고 이미 저작자가 정한 값은 덮지 않는다(??=). 새 그림은 만들지 않는다 — 번들 그림만 고른다.
//  1) 하루 루프: 시간 시스템(강제 취침) + socialLoop(하루 칸 3, 사람별 호감 상한 20)
//  2) 호감 하트 HUD: 전투 체력 하트 대신 인물 호감을 하트로, 남은 대화 칸과 시계를 글자로
//  3) 장르 잠금(romance): 시작 맵이 현대 학교·도시 계열일 때만 켠다 — 환상 무대의 연애(궁정·마법 학교)는 잠그지 않는다.
//     켜면 맵 칩셋뿐 아니라 인물 칩도 현대 연애 칩 Modern1~3 로 묶고(주인공 기본 외형 포함), ESC 메뉴는 전투 능력치 대신 호감도 중심(relationshipMenu.ts)이 된다
//  4) 연애에 어울리는 번들 타이틀 그림(눈 덮인 마을 기본값 대신)
//  5) 시작 맵 BGM — 비어 있으면 현대 일상 곡(잔잔한 찻집·옥상 저녁 따위) 하나
import { DUAL_FULLBODY_VEIL_PRESET_ID, ROMANCE_FULL_PORTRAIT_DEFAULTS, romanceDialogueSystem } from "./dialogueSystem";
import { ensureHighResFullbodyPlayResolution } from "./playResolution";
import { romanceVnExtras } from "./vnExtras";
import { DEADLINE_ENDING_COMMON_EVENT_ID, installDeadlineEnding, type DeadlineTier } from "@/project/deadlineEnding";
import { ROMANCE_ENDING_HAPPY_AT, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_AT, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID } from "@/project/playableSegmentContract";
import { ANY_FRIENDSHIP_KEY } from "@/project/session";
import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR } from "@/project/gameTime";
import { DEFAULT_SOCIAL_DAILY_FRIENDSHIP_CAP, DEFAULT_SOCIAL_SLOTS_PER_DAY } from "@/project/socialLoop";
import { GENRE_LOCK_PRESETS } from "@/project/genreLock";
import { enableGenreLockSettled } from "@/project/genreLockCharsets";
import { normalizeHudWidget, type FieldHudConfig } from "@/project/fieldHud";
import { tilesetFamily } from "@/project/tilesetFamily";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { isRomanceTitleArtId, romanceTitleArtForText, ROMANCE_TITLE_RESOURCE_ID } from "@/project/romanceTitleArt";
import type { Project } from "@/project/types";

/**
 * 연애 기본 타이틀 — 벚꽃 교정 옥상의 노을, 교복 둘이 난간에 기대 교정을 내려다본다(후보 C, 감독 확정 2026-10-16).
 * 생성형 이미지 모델(gpt-image-2.5-sunburst)로 만든 큰 그림이고 `public/assets/generated/title/romance-campus-spring.jpg` 에 있다.
 * 위쪽 하늘이 넓어 로고 자리가 비고, 960×720 가운데 잘림에서도 인물 둘이 남는다.
 * 이전 기본(`oprn-still-moon-meadow` = 벽난로 앞 두 노인)은 캠퍼스 연애와 어울리지 않아 바꿨다 — 그 id 도 「손대지 않은 기본」으로 보아 다시 적용할 때 새 그림으로 바꾼다.
 */
export { ROMANCE_TITLE_RESOURCE_ID };
/** 코드가 기본으로 깔아 둔(= 저작자가 안 고른) 타이틀 배경. 이 값일 때만 바꾼다(옛 연애 기본 포함). */
const UNTOUCHED_TITLE_BACKGROUNDS: ReadonlySet<string> = new Set(["oprn-title-field", "rpg-zzu-title-field", "oprn-still-moon-meadow"]);

/** 연애 기본 타이틀 부제 — 「A NEW ADVENTURE」 모험 문구를 대신한다. */
export const ROMANCE_TITLE_SUBTITLE = "마음이 닿는 계절";

export const ROMANCE_MINUTES_PER_REAL_SECOND = 0.1;
/** 기한 엔딩 — 이 날수째 하루가 저물면 누적 호감으로 결말이 갈린다(2026-10-16 R01: 하루 루프가 아무것도 소비하지 않았다). */
export const ROMANCE_DEADLINE_DAYS = 14;

export function isRomanceInterviewProject(project: Project): boolean {
  return project.gameDesignBrief?.interview?.genre === "romance";
}

/** 호감 하트 HUD 위젯(체력 하트를 대신한다). */
export function romanceHudConfig(previous: FieldHudConfig | undefined): FieldHudConfig {
  const w = (id: string, patch: Record<string, unknown>) => normalizeHudWidget({ id, ...patch });
  return {
    theme: "hearts", font: "pixel", ...(previous?.menuStyle ? { menuStyle: previous.menuStyle } : {}),
    vitals: false, clock: true, tools: false, objective: false, hideEmpty: true,
    widgets: [
      // 2026-10-16 R06: 호감 목록·남은 시간 판이 지도 위쪽과 실내 위쪽을 상시 덮었다. 이제 이 둘은 값이 바뀐 뒤 3초만(대화가 끝나 HUD 가 다시 보일 때) 뜬다 —
      // 평소 화면은 모서리 시계 칩 하나뿐이고, 그 칩도 플레이어가 위쪽에 서면 아래쪽으로 옮겨 간다(autoAvoid). 전체 목록은 ESC 「호감도」.
      w("slots-left", { kind: "text", source: "socialSlots", label: "", y: 6, width: 132, height: 20, color: "#f4d17b", panel: "dark", condition: "changed" }),
      w("affection", { kind: "party", source: "friendship", label: "", shape: "hearts", y: 30, width: 132, height: 58, slots: 3, color: "#ef6a68", showValue: false, max: 100, panel: "dark", condition: "changed" }),
      w("clock", { kind: "clock", label: "", shape: "number", anchor: "top-right", x: 6, y: 6, width: 104, height: 22, panel: "dark", autoAvoid: true }),
    ],
  };
}

/** 2026-10-16 이전 기본 HUD(호감 목록·남은 시간이 항상 떠 지도를 덮던 배치)인가. 저작자가 손댄 위젯 수·id·조건이 다르면 아니다. */
export function isLegacyRomanceHud(hud: FieldHudConfig | undefined): boolean {
  const widgets = hud?.widgets;
  if (!widgets || widgets.length !== 3) return false;
  const byId = new Map(widgets.map(widget => [widget.id, widget]));
  const slots = byId.get("slots-left"), affection = byId.get("affection"), clock = byId.get("clock");
  if (!slots || !affection || !clock) return false;
  return slots.condition === "always" && affection.condition === "always" && clock.height >= 40 && affection.y === 34 && slots.y === 8;
}

/** 연애 프로젝트에 결정론 기본값을 깐다. 깐 항목 이름을 돌려준다(이미 있던 것은 목록에 없다). */
export function applyRomanceDefaults(project: Project, options: { readonly force?: boolean } = {}): string[] {
  // force: 인터뷰 없이 채팅 한 줄(「연애 게임을 만들고 싶어」)로 시작한 게임 — 조수 v2 가 첫 장소를 지은 뒤 부른다(2026-10-25 조수 단독 게임 G17/G18).
  if (!options.force && !isRomanceInterviewProject(project)) return [];
  const applied: string[] = [];
  const { system } = project;
  if (!system.timeSystem) {
    system.timeSystem = {
      enabled: true,
      // 연애 루프의 시간은 대화 칸이 움직인다 — 자연 시계는 거의 멈춘 듯 느리게(0.1분/초 = 하루 3시간 20분).
      minutesPerRealSecond: ROMANCE_MINUTES_PER_REAL_SECOND,
      dayStartHour: DEFAULT_DAY_START_HOUR,
      dayEndHour: DEFAULT_DAY_END_HOUR,
      daysPerSeason: 28,
      // 하루 칸을 다 쓰면 하루가 저문다(연애 루프) — 이 값이 꺼져 있으면 기한 엔딩이 영원히 오지 않는다.
      forceSleep: true,
    };
    applied.push("timeSystem");
  }
  if (!system.socialLoop) {
    system.socialLoop = { slotsPerDay: DEFAULT_SOCIAL_SLOTS_PER_DAY, dailyFriendshipCap: DEFAULT_SOCIAL_DAILY_FRIENDSHIP_CAP };
    applied.push("socialLoop");
  }
  // 기한 엔딩: 뼈대의 해피·평범·혼자 엔딩이 있고 아직 기한 판정이 없을 때만. 하루 루프가 결말로 이어지게 한다.
  if (system.timeSystem?.enabled && !system.timeSystem.onDayEnd
    && (project.endings ?? []).some((ending) => ending.id === ROMANCE_ENDING_HAPPY_ID)
    && !project.commonEvents.some((event) => event.id === DEADLINE_ENDING_COMMON_EVENT_ID)) {
    const tiers: DeadlineTier[] = [
      { endingId: ROMANCE_ENDING_HAPPY_ID, threshold: ROMANCE_ENDING_HAPPY_AT, characterId: ANY_FRIENDSHIP_KEY },
      { endingId: ROMANCE_ENDING_NORMAL_ID, threshold: ROMANCE_ENDING_NORMAL_AT, characterId: ANY_FRIENDSHIP_KEY },
      { endingId: SEGMENT_END_ENDING_ID },
    ];
    if (installDeadlineEnding(project, ROMANCE_DEADLINE_DAYS, tiers)) applied.push("deadlineEnding");
  }
  // HUD: 저작자가 위젯을 직접 정하지 않았을 때만. 지도를 덮던 옛 기본 배치(조건 없는 세 판)는 새 배치로 바꾼다.
  if (system.fieldHud?.widgets === undefined || isLegacyRomanceHud(system.fieldHud)) {
    system.fieldHud = romanceHudConfig(system.fieldHud);
    applied.push("fieldHud");
  }
  // 타이틀: 코드 기본값(눈 덮인 마을)일 때만.
  const title = system.titleScreen;
  if (title && (title.backgroundResourceId === undefined || UNTOUCHED_TITLE_BACKGROUNDS.has(title.backgroundResourceId))) {
    // 기획서가 카페·학원·회사·마을이면 그 소재의 키아트로 시작한다(R1-06). 소재 낱말이 없으면 벚꽃 캠퍼스.
    const brief = project.gameDesignBrief;
    const briefText = [brief?.summary ?? "", ...Object.values(brief?.answers ?? {}).map((answer) => answer?.text ?? "")].join("\n");
    system.titleScreen = { ...title, backgroundResourceId: romanceTitleArtForText(briefText)?.id ?? ROMANCE_TITLE_RESOURCE_ID, backgroundFit: "cover" };
    applied.push("titleScreen");
  }
  // 타이틀 문구: 기본 「A NEW ADVENTURE / 이야기가 시작되는 곳」은 모험 게임 문구다(연애 첫 실측: 연애 그림 위에 그대로 남음). 글자 질감을 정하면 그 기본 문구가 숨고 부제만 남는다.
  // 제목 자체는 조수가 게임에 맞게 정한다(set_title_screen title) — 코드는 기본 문구만 걷고 부드러운 부제를 둔다. 저작자가 정한 값은 건드리지 않는다.
  const copy = system.titleScreen;
  if (copy && copy.logoStyle === undefined && copy.logoSubtitle === undefined && isRomanceTitleArtId(copy.backgroundResourceId)) {
    system.titleScreen = { ...copy, logoStyle: "glow", logoSubtitle: ROMANCE_TITLE_SUBTITLE };
    applied.push("titleCopy");
  }
  // 장르 잠금: 시작 맵이 허용 계열(현대 학교·도시)일 때만.
  const start = project.maps[project.startMapId];
  if (!system.genreLock && start && GENRE_LOCK_PRESETS.romance.families.includes(tilesetFamily(project, start.tilesetId))) {
    if (enableGenreLockSettled(project, "romance")) applied.push("genreLock");
  }
  const hero = project.database.actors[0];
  if (hero && /^(?:주인공|모험가|배우\s*\d+|Hero|Actor\s*\d+)$/iu.test(hero.name.trim())) {
    hero.name = "한결";
    if (hero.nickname === "없음") hero.nickname = "";
    applied.push("heroName");
  }
  // 연애 기본 대화창 프리셋: 전신 양쪽 스탠딩 + 반투명 다크 베일 대화창(저작자가 다른 스타일을 직접 고르지 않았을 때만).
  if (system.dialogueStyle === undefined || system.dialogueStyle === "pixel-cinematic") {
    system.dialogueStyle = DUAL_FULLBODY_VEIL_PRESET_ID;
    applied.push("dialogueStyle");
  }
  if (system.dialogueStyle === DUAL_FULLBODY_VEIL_PRESET_ID && ensureHighResFullbodyPlayResolution(system)) {
    applied.push("playResolution");
  }
  if (!system.dialogueFullPortrait) {
    system.dialogueFullPortrait = { ...ROMANCE_FULL_PORTRAIT_DEFAULTS };
    applied.push("dialogueFullPortrait");
  }
  // 대사창 읽기 보조(백로그·오토·스킵·숨기기): 저작이 없을 때만 연애 기본 구성을 명시 저작으로 심는다(2026-10-17). 저작자가 정한 값은 건드리지 않는다.
  if (!project.meta.oprnDialogueSystem) {
    project.meta.oprnDialogueSystem = romanceDialogueSystem();
    applied.push("dialogueSystem");
  }
  // 미연시 추가 화면(갤러리 잠금·엔딩 목록·세이브 카드): 같은 방식. 저작이 없을 때만 연애 기본 구성을 명시 저작으로 심는다.
  if (!project.meta.oprnVnExtras) {
    project.meta.oprnVnExtras = romanceVnExtras();
    applied.push("vnExtras");
  }
  // 시작 맵 BGM: 비어 있을 때만. 연애 전용 곡은 카탈로그에 없어 가장 가까운 잔잔한 일상 곡을 고른다.
  if (start && !start.bgm) {
    start.bgm = { mode: "custom", resourceId: recommendMapBgm(start.name, 1, undefined, { fallbackTheme: "everyday" }) };
    applied.push("startMapBgm");
  }
  return applied;
}
