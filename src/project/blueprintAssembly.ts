// project/blueprintAssembly.ts
// 게임 조립 기본값 — 청사진(gameBlueprint)이 있는 게임의 타이틀·오프닝을 결정적으로 맞춘다(2026-10-28 스위트 조립 장부).
//
// 왜: 조수가 지은 방탈출 게임 셋(flash·argon·terra)의 타이틀이 편집기 기본 「눈 덮인 산촌」 그림과 「A NEW ADVENTURE /
// 이야기가 시작되는 곳」 문구 그대로였고, 오프닝은 기본 「강을 낀 왕국」 판타지 그림이었다. 싼 모델은 set_title_screen·set_opening 을
// 틀리게 부르거나(argon 「같은 인자 모양 오류 4번째 — 거절」) 아예 부르지 않는다. 그래서 고르기를 모델에게 맡기지 않고
// 청사진의 장르·장소·목표 낱말로 번들 그림을 고르고, 기본 문구를 게임의 장르·장소로 바꾸고, 손대지 않은 기본 왕국 오프닝은 끈다.
//
// 규칙: 저작자(사람·조수)가 고른 값은 덮지 않는다. 바꾸는 것은 «아무도 고르지 않은 기본값»과 «타이틀에 쓰면 안 되는 그림»
// (격자선이 박힌 참고 스틸·하늘만 있는 배경 층·이야기에 없는 풍토의 그림)뿐이다. 새 그림은 만들지 않는다.
import { findOpeningStillMood, listOpeningStillMoods } from "@/assets/openingStillMoods";
import { findOpeningPreset } from "@/editor/openingPresets";
import { romanceTitleArtForText, ROMANCE_TITLE_RESOURCE_ID, isRomanceTitleArtId } from "@/project/romanceTitleArt";
import type { GameBlueprint } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";

/** 편집기·씨앗이 깔아 둔(= 아무도 고르지 않은) 타이틀 배경. */
const UNTOUCHED_TITLE_BACKGROUNDS: ReadonlySet<string> = new Set(["oprn-title-field", "rpg-zzu-title-field"]);
/** 씨앗·빈 프로젝트가 남기는 기본 제목. */
const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set(["새 프로젝트", "새 게임", "New Project", "New Game", ""]);
/** 하늘만 있는 배경 층(장소가 아니다). 도시 실루엣 층은 장소로 친다 — ai/v2/shipChecks isSkyOnlyImage 와 같은 규칙. */
const SKY_ONLY = /^oprn-pano-(night|sky-day(?!-city)|sunset(?!-skyline)|clouds|sea)/u;

/**
 * 스틸 카탈로그 밖의 번들 타이틀 그림 중 장르 타이틀로 쓸 수 있는 것. text 는 그림을 실제로 보고 쓴 설명이다.
 * horror-mystery-blue-gallery: 달빛이 드는 어두운 빈 방, 벽에 걸린 커다란 빈 액자, 오른쪽 열린 문 — 사람이 없다.
 */
const EXTRA_TITLE_ARTS: readonly { readonly id: string; readonly name: string; readonly text: string }[] = [
  { id: "horror-mystery-blue-gallery", name: "달빛 드는 빈 방", text: "달빛 드는 어두운 빈 방 벽의 빈 액자 낡은 저택 실내 밀실 미스터리 적막 공포 불안" },
];

/**
 * 이야기 낱말 → 그림 낱말. 이야기가 story 에 걸리면 그림 설명이 art 에 걸리는 만큼 점수를 준다.
 * 한 글자 낱말(성·눈·별)은 「성취감」「눈물」 같은 데 걸려 쓰지 않는다.
 */
const THEMES: readonly { readonly story: RegExp; readonly art: RegExp; readonly weight: number }[] = [
  { story: /방탈출|탈출|밀실|잠긴|갇힌|금고|자물쇠|암호|서재|공방|저택|추리|미스터리|탐정|사건|도난|범인|escape|mystery/iu, art: /밀실|빈 방|실내|저택|회랑|복도|미스터리|적막|초상화/gu, weight: 3 },
  { story: /공포|호러|귀신|유령|저주|괴담|폐병원|폐교|좀비|괴물|비명|horror/iu, art: /공포|불안|긴장|폐병원|기괴|위협/gu, weight: 3 },
  { story: /병원|의사|간호/u, art: /병원/gu, weight: 4 }, // 장소가 딱 맞는 그림(폐병원)이 분위기만 맞는 그림(초상화 복도)을 이긴다
  { story: /사막|모래|피라미드|오아시스|desert/iu, art: /사막|모래|피라미드|오아시스/gu, weight: 3 },
  { story: /바다|해저|항구|해변|등대|어촌|ocean|harbor/iu, art: /해저|바다|항구|등대|해안/gu, weight: 3 },
  { story: /하늘섬|공중|비행선|부유/u, art: /공중|하늘섬|비행선|구름 위/gu, weight: 3 },
  { story: /눈 덮인|눈보라|눈이 |설원|겨울|얼음|크리스마스|winter|snow/iu, art: /설원|눈 덮인|겨울/gu, weight: 3 },
  { story: /농장|농사|시골|귀향|목장|밭|농가/u, art: /농장|농가|시골|밭/gu, weight: 3 },
  { story: /왕국|성벽|성채|왕성|기사|용사|공주|왕자|모험/u, art: /왕국|성벽|성왕국|세계 소개/gu, weight: 1 },
  { story: /마왕|암흑|악마|어둠의/u, art: /검은 성채|암흑|위협/gu, weight: 2 },
  { story: /꿈|몽환|악몽/u, art: /꿈|몽환/gu, weight: 3 },
  { story: /현대|도시|회사|기차|열차|역 앞|아파트|편의점/u, art: /현대|시골역|옥상|도시/gu, weight: 2 },
  { story: /동굴|야영|캠프/u, art: /동굴|야영/gu, weight: 2 },
  { story: /가족|할머니|할아버지|회상|추억|유품|그리움|벽난로/u, art: /벽난로|가족의 회상|그리움|온기/gu, weight: 2 },
];

/** 그림 설명의 풍토 낱말 — 이야기에 같은 계열 낱말이 없으면 «다른 이야기 그림»이라 타이틀에서 뺀다(shipChecks offPremiseArt 와 같은 표). */
const SETTING_CLASH: readonly { readonly art: RegExp; readonly premise: RegExp }[] = [
  { art: /눈 덮인|설원|겨울|눈 쌓인|winter|snow|얼음|오로라/iu, premise: /눈|겨울|설원|얼음|빙|크리스마스|winter|snow|ice/iu },
  { art: /사막|모래|피라미드|desert|오아시스/iu, premise: /사막|모래|피라미드|오아시스|desert/iu },
  { art: /해저|바다|항구|ocean|harbor/iu, premise: /바다|해저|항구|섬|배를|해변|ocean|sea|harbor/iu },
];

function stillText(id: string): string {
  const still = findOpeningStillMood(id);
  if (still) return [still.name, still.description, ...still.tags, ...still.mood, ...still.useCases].join(" ");
  const extra = EXTRA_TITLE_ARTS.find((art) => art.id === id);
  if (extra) return `${extra.name} ${extra.text}`;
  return UNTOUCHED_TITLE_BACKGROUNDS.has(id) ? "별빛 아래 눈 덮인 산과 소나무, 등불 켜진 눈 마을" : "";
}

/** 청사진의 의도 메모(시스템 지침)는 사용자 글이 아니다 — 그 앞까지만. */
function requestText(request: string | undefined): string {
  return (request ?? "").split(/\[의도 메모/u)[0] ?? "";
}

/** 청사진의 장소 이름을 맵 이름으로 푼다(모델이 맵 id 를 장소로 적기도 한다 — flash 방탈출 「map_blank_start」). */
export function blueprintPlaceName(project: Project, blueprint: GameBlueprint): string {
  const place = blueprint.steps[0]?.place?.trim() ?? "";
  const map = project.maps[place];
  if (map?.name?.trim()) return map.name.trim();
  if (place && !/^[a-z0-9_\-]+$/iu.test(place)) return place;
  return project.maps[project.startMapId]?.name?.trim() ?? "";
}

/** 풍토 검사에 쓰는 이야기 전체 글(제목·장르·목표·핵심 경로·엔딩·요청·장소 이름). 느낌 칸은 뺀다(「성취감」 같은 낱말이 섞인다). */
export function blueprintStoryText(project: Project, blueprint: GameBlueprint): string {
  return [
    blueprintPremiseText(project, blueprint),
    ...blueprint.steps.flatMap((step) => [step.event, step.action]),
    blueprint.ending.name, blueprint.ending.how,
  ].join("\n");
}

/**
 * 그림 고르기에 쓰는 «이 게임이 무엇인가» 글 — 장르·제목·목표·요청·장소 이름. 단계 하나하나의 소품 낱말(「별자리 암호」)은 빼야
 * 마법 학교 이야기가 방탈출 그림을 받지 않는다.
 */
export function blueprintPremiseText(project: Project, blueprint: GameBlueprint): string {
  const places = [...new Set(blueprint.steps.map((step) => project.maps[step.place]?.name ?? step.place))];
  return [blueprint.genre, blueprint.title, blueprint.playerGoal, requestText(blueprint.request), ...places].join("\n");
}

export interface TitleArtPick { readonly id: string; readonly name: string; readonly score: number }

/** 번들 스틸이 하나도 맞지 않는 시대·문화권·장르(서양 저택·판타지 스틸뿐이다, 몬스터 수집은 전용 키아트가 따로 있다) — 엉뚱한 그림 대신 고르지 않는다. */
const NO_BUNDLED_ART_ERA = /조선|한양|사극|궁궐|무림|무협|중원|강호|에도|사무라이|몬스터 수집|포켓몬|monster collect/iu;

/**
 * 이야기 글로 번들 타이틀 그림을 고른다. premise = 이 게임이 무엇인가(장르·제목·목표·요청·장소), story = 풍토 검사용 전체 글.
 * 낱말이 하나도 맞지 않으면 undefined(엉뚱한 그림을 지어 고르지 않는다). 같은 글 → 같은 그림.
 */
export function pickTitleArtForStory(premise: string, story = premise): TitleArtPick | undefined {
  if (/연애|로맨스|데이트|고백|미연시|romance|dating/iu.test(premise)) {
    const id = romanceTitleArtForText(story, true)?.id ?? ROMANCE_TITLE_RESOURCE_ID;
    return { id, name: id, score: 1 };
  }
  if (NO_BUNDLED_ART_ERA.test(premise)) return undefined;
  const themes = THEMES.filter((theme) => theme.story.test(premise));
  if (!themes.length) return undefined;
  const candidates = [
    ...EXTRA_TITLE_ARTS.map((art) => ({ id: art.id, name: art.name })),
    ...listOpeningStillMoods().filter((still) => still.suitableForOpening && !SKY_ONLY.test(still.id)).map((still) => ({ id: still.id, name: still.name })),
  ];
  let best: TitleArtPick | undefined;
  for (const candidate of candidates) {
    const text = stillText(candidate.id);
    if (SETTING_CLASH.some((s) => s.art.test(text) && !s.premise.test(story))) continue;
    let score = 0;
    for (const theme of themes) score += theme.weight * Math.min(3, (text.match(theme.art) ?? []).length);
    if (score > 0 && (!best || score > best.score)) best = { ...candidate, score };
  }
  return best;
}

/** 이 프로젝트의 청사진에 맞는 타이틀 그림(청사진이 없거나 맞는 그림이 없으면 undefined). */
export function pickBlueprintTitleArt(project: Project): TitleArtPick | undefined {
  const blueprint = project.gameBlueprint;
  return blueprint ? pickTitleArtForStory(blueprintPremiseText(project, blueprint), blueprintStoryText(project, blueprint)) : undefined;
}

/**
 * 지금 타이틀 배경을 청사진 그림으로 바꿔도 되는가: 아무도 안 골랐거나(편집기 기본), 타이틀에 쓰면 안 되는 그림(격자·분할 참고 스틸),
 * 하늘만 있는 배경 층, 이야기에 없는 풍토(눈·사막·바다)의 그림. 생성·업로드 그림과 연애 키아트는 건드리지 않는다.
 */
function replaceableTitleBackground(id: string | undefined, story: string): boolean {
  if (!id || UNTOUCHED_TITLE_BACKGROUNDS.has(id)) return true;
  if (isRomanceTitleArtId(id)) return false;
  if (findOpeningStillMood(id)?.suitableForOpening === false) return true;
  if (SKY_ONLY.test(id)) return true;
  const text = stillText(id);
  return !!text && SETTING_CLASH.some((s) => s.art.test(text) && !s.premise.test(story));
}

/** 타이틀 부제: 「장르 · 장소」(장르가 이미 길거나 묶음이면 장소만). 기본 문구 「A NEW ADVENTURE / 이야기가 시작되는 곳」을 대신한다. */
export function blueprintTitleSubtitle(project: Project, blueprint: GameBlueprint): string {
  const genre = blueprint.genre.trim();
  const place = blueprintPlaceName(project, blueprint);
  const text = !place ? genre : /[·,/]/u.test(genre) || genre.length > 10 || place.includes(genre) ? place : `${genre} · ${place}`;
  return text.slice(0, 60);
}

/** kingdom-prologue(새 프로젝트 기본 오프닝)의 그림 장면 글. 이 글뿐인 오프닝은 아무도 고르지 않은 기본이다. */
function defaultOpeningNarrations(): ReadonlySet<string> {
  const preset = findOpeningPreset("kingdom-prologue");
  return new Set((preset?.scenes ?? []).filter((scene) => scene.resourceId).map((scene) => scene.narration.trim()));
}

/** 기본 왕국 오프닝 장면(그림 장면)만 남은 오프닝인가 — 제목 카드 글 장면은 세지 않는다. */
export function isLeftoverDefaultOpening(project: Project): boolean {
  const opening = project.system.opening;
  if (!opening || opening.enabled === false) return false;
  const narrations = defaultOpeningNarrations();
  const pictured = opening.scenes.filter((scene) => scene.kind !== "text");
  return pictured.length > 0 && pictured.every((scene) => narrations.has(String(scene.narration ?? "").trim()));
}

/**
 * 청사진이 있는 게임에 조립 기본값을 깐다. 저작자가 고른 값은 덮지 않는다. 바꾼 항목 설명을 돌려준다(없으면 빈 배열).
 *  1) 기본 제목 → 청사진 제목
 *  2) 기본·부적합 타이틀 배경 → 청사진 장르·장소에 맞는 번들 그림(맞는 그림이 없으면 그대로 — 출하 검사가 짚는다)
 *  3) 기본 문구(A NEW ADVENTURE) → 「장르 · 장소」 부제
 *  4) 손대지 않은 기본 왕국 오프닝 → 끈다(게임이 시작 맵에서 바로 시작한다)
 */
export function applyBlueprintAssembly(project: Project): string[] {
  const blueprint = project.gameBlueprint;
  if (!blueprint) return [];
  const applied: string[] = [];
  const system = project.system;
  const title = system.titleScreen;
  if (title) {
    if (PLACEHOLDER_TITLES.has(title.title.trim())) {
      title.title = blueprint.title;
      applied.push(`타이틀 제목 「${blueprint.title}」`);
    }
    if (PLACEHOLDER_TITLES.has(project.meta.title.trim())) project.meta = { ...project.meta, title: title.title };
    const story = blueprintStoryText(project, blueprint);
    const current = title.backgroundResourceId ?? system.titleResourceId;
    if (replaceableTitleBackground(current, story)) {
      const pick = pickTitleArtForStory(blueprintPremiseText(project, blueprint), story);
      if (pick && pick.id !== current) {
        title.backgroundResourceId = pick.id;
        title.backgroundFit ??= "cover";
        applied.push(`타이틀 그림 ${current ?? "(없음)"} → ${pick.id}(${pick.name})`);
      }
    }
    if (title.logoStyle === undefined && !title.logoSubtitle?.trim()) {
      const subtitle = blueprintTitleSubtitle(project, blueprint);
      if (subtitle) {
        title.logoSubtitle = subtitle;
        applied.push(`타이틀 부제 「${subtitle}」(기본 문구 대신)`);
      }
    }
  }
  if (isLeftoverDefaultOpening(project)) {
    system.opening = { ...system.opening!, enabled: false, scenes: [] };
    applied.push("기본 왕국 오프닝을 껐다");
  }
  return applied;
}

// ── 시간대 어긋남 검사 ─────────────────────────────────────────────────

type TimeOfDay = 0 | 1 | 2 | 3; // 아침 · 낮 · 저녁 · 밤
const TIME_LABEL = ["아침", "낮", "저녁", "밤"] as const;
const TIME_WORDS: readonly { readonly time: TimeOfDay; readonly re: RegExp }[] = [
  { time: 0, re: /아침|새벽|오전|동틀|일출|해 뜰/u },
  { time: 1, re: /한낮|대낮|낮에|낮의|낮이|정오|오후/u },
  { time: 2, re: /저녁|노을|해질녘|해 질|황혼|석양|일몰/u },
  { time: 3, re: /밤(?!나무|송이|색|껍)|자정|심야|야밤/u },
];
/** 지난 일을 말하는 글(회상 장면) — 지금 시간이 아니다. */
const PAST = /전[ ,에]|전$|어젯|지난|옛날|그날|오래전|예전|과거|회상|기억 속/u;

function timeOf(text: string): TimeOfDay | undefined {
  let first: { time: TimeOfDay; at: number } | undefined;
  for (const word of TIME_WORDS) {
    const at = text.search(word.re);
    if (at >= 0 && (!first || at < first.at)) first = { time: word.time, at };
  }
  return first?.time;
}

export interface AssemblyTimeMismatch { readonly message: string; readonly evidence: string }

/**
 * 타이틀 부제·오프닝·청사진이 말하는 «시작 시간»이 어긋나는가(2026-10-28 standin magic: 부제 「별빛 마법학교의 첫날 밤」인데
 * 오프닝 첫 장면은 「입학식 날 아침」). 기준은 청사진(제목·목표·첫 단계)의 시간, 없으면 타이틀 부제. 회상 장면(「사흘 전 밤」)은 세지 않는다.
 * 아침↔저녁·밤, 낮↔밤처럼 두 칸 이상 떨어지면 어긋남이다(저녁↔밤은 이어진다).
 */
export function assemblyTimeMismatches(project: Project): AssemblyTimeMismatch[] {
  const blueprint = project.gameBlueprint;
  const subtitle = project.system.titleScreen?.logoSubtitle?.trim() ?? "";
  const opening = project.system.opening;
  const scenes = opening && opening.enabled !== false ? opening.scenes : [];
  const present = scenes.map((scene) => String(scene.narration ?? "").trim()).filter((text) => text && !PAST.test(text) && timeOf(text) !== undefined);
  const sources: { label: string; text: string; time: TimeOfDay }[] = [];
  const add = (label: string, text: string) => { const time = timeOf(text); if (time !== undefined) sources.push({ label, text, time }); };
  if (blueprint) add("청사진", [blueprint.title, blueprint.playerGoal, blueprint.steps[0]?.action ?? ""].join(" "));
  if (subtitle) add("타이틀 부제", subtitle);
  if (present[0]) add("오프닝 첫 장면", present[0]);
  const reference = sources[0];
  if (!reference) return [];
  return sources.slice(1).filter((source) => Math.abs(source.time - reference.time) >= 2).map((source) => ({
    message: `${source.label} 「${source.text.slice(0, 40)}」는 ${TIME_LABEL[source.time]}인데 ${reference.label} 「${reference.text.slice(0, 40)}」는 ${TIME_LABEL[reference.time]}이다 — `
      + (source.label === "타이틀 부제" ? `set_title_screen{logoSubtitle} 을 ${TIME_LABEL[reference.time]}에 맞춰 다시 쓴다.` : `edit_opening 으로 그 장면 글을 ${TIME_LABEL[reference.time]}에 맞추거나 회상이면 「…전」을 밝힌다.`),
    evidence: `${reference.label}=${TIME_LABEL[reference.time]} ${source.label}=${TIME_LABEL[source.time]}`,
  }));
}
