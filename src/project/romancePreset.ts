// project/romancePreset.ts
// 관계·연애 장르의 결정론 기본값(2026-10-16 연애 감사). 인터뷰가 연애(주 장르)로 시작한 프로젝트에만 한 번 깐다.
// 전부 옵트인 필드이고 이미 저작자가 정한 값은 덮지 않는다(??=). 새 그림은 만들지 않는다 — 번들 그림만 고른다.
//  1) 하루 루프: 시간 시스템(강제 취침) + socialLoop(하루 칸 3, 사람별 호감 상한 20)
//  2) 호감 하트 HUD: 전투 체력 하트 대신 인물 호감을 하트로, 남은 대화 칸과 시계를 글자로
//  3) 장르 잠금(romance): 시작 맵이 현대 학교·도시 계열일 때만 켠다 — 환상 무대의 연애(궁정·마법 학교)는 잠그지 않는다
//  4) 연애에 어울리는 번들 타이틀 그림(눈 덮인 마을 기본값 대신)
import { DEFAULT_DAY_END_HOUR, DEFAULT_DAY_START_HOUR } from "@/project/gameTime";
import { DEFAULT_SOCIAL_DAILY_FRIENDSHIP_CAP, DEFAULT_SOCIAL_SLOTS_PER_DAY } from "@/project/socialLoop";
import { enableGenreLock, GENRE_LOCK_PRESETS } from "@/project/genreLock";
import { normalizeHudWidget, type FieldHudConfig } from "@/project/fieldHud";
import { tilesetFamily } from "@/project/tilesetFamily";
import type { Project } from "@/project/types";

/**
 * 연애 기본 타이틀 — 벚꽃 교정 옥상의 노을, 교복 둘이 난간에 기대 교정을 내려다본다(후보 C, 감독 확정 2026-10-16).
 * 생성형 이미지 모델(gpt-image-2.5-sunburst)로 만든 큰 그림이고 `public/assets/generated/title/romance-campus-spring.jpg` 에 있다.
 * 위쪽 하늘이 넓어 로고 자리가 비고, 960×720 가운데 잘림에서도 인물 둘이 남는다.
 * 이전 기본(`oprn-still-moon-meadow` = 벽난로 앞 두 노인)은 캠퍼스 연애와 어울리지 않아 바꿨다 — 그 id 도 「손대지 않은 기본」으로 보아 다시 적용할 때 새 그림으로 바꾼다.
 */
export const ROMANCE_TITLE_RESOURCE_ID = "oprn-title-romance-campus";
/** 코드가 기본으로 깔아 둔(= 저작자가 안 고른) 타이틀 배경. 이 값일 때만 바꾼다(옛 연애 기본 포함). */
const UNTOUCHED_TITLE_BACKGROUNDS: ReadonlySet<string> = new Set(["oprn-title-field", "rpg-zzu-title-field", "oprn-still-moon-meadow"]);

export const ROMANCE_MINUTES_PER_REAL_SECOND = 0.1;

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
      // 호감 목록: 호감이 기록된 사람을 높은 순으로 셋까지(이름 + 하트). 한 사람뿐이면 한 줄.
      w("slots-left", { kind: "text", source: "socialSlots", label: "", y: 8, width: 128, height: 20, color: "#f4d17b" }),
      w("affection", { kind: "party", source: "friendship", label: "", shape: "hearts", y: 30, width: 128, height: 56, slots: 3, color: "#ef6a68", showValue: false, max: 100 }),
      w("clock", { kind: "clock", label: "", anchor: "top-right", width: 76, height: 44 }),
    ],
  };
}

/** 연애 프로젝트에 결정론 기본값을 깐다. 깐 항목 이름을 돌려준다(이미 있던 것은 목록에 없다). */
export function applyRomanceDefaults(project: Project): string[] {
  if (!isRomanceInterviewProject(project)) return [];
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
  // HUD: 저작자가 위젯을 직접 정하지 않았을 때만.
  if (system.fieldHud?.widgets === undefined) {
    system.fieldHud = romanceHudConfig(system.fieldHud);
    applied.push("fieldHud");
  }
  // 타이틀: 코드 기본값(눈 덮인 마을)일 때만.
  const title = system.titleScreen;
  if (title && (title.backgroundResourceId === undefined || UNTOUCHED_TITLE_BACKGROUNDS.has(title.backgroundResourceId))) {
    system.titleScreen = { ...title, backgroundResourceId: ROMANCE_TITLE_RESOURCE_ID, backgroundFit: "cover" };
    applied.push("titleScreen");
  }
  // 장르 잠금: 시작 맵이 허용 계열(현대 학교·도시)일 때만.
  const start = project.maps[project.startMapId];
  if (!system.genreLock && start && GENRE_LOCK_PRESETS.romance.families.includes(tilesetFamily(project, start.tilesetId))) {
    if (enableGenreLock(project, "romance")) applied.push("genreLock");
  }
  return applied;
}
