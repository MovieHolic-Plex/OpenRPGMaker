// 출하 검사 가운데 그림·제목 — 하늘만 보이는 오프닝, 전제와 어긋난 그림, 기본 장소 이름·제목 누출, 제목 불일치, 오프닝 없음, 엔진 번들 그림.
import { endingBackdropCandidates, isBundledPictureId } from "@/project/defaultLeaks";
import { ROMANCE_TITLE_BACKGROUNDS, isRomanceTitleTarget } from "@/project/romanceTitleArt";
import type { Project } from "@/project/types";
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { blankMap, blueprintStoryText } from "@/project/blueprintAssembly";
import { openingMapViewMapId } from "@/project/openingMapView";
import { requestedTitle } from "../request/title";
import { Obj, ShipBlocker } from "./shipCheckReads";

/**
 * 하늘만 있는 일반 배경 층(oprn-pano-*·편집기 기본 타이틀) — 장소가 아니다. 밤하늘·별·노을·맑은 하늘·구름·바다 수면뿐이다.
 * 도시 실루엣 층(skyline·city)은 장소로 친다.
 */
const SKY_ONLY = /^oprn-pano-(night|sky-day(?!-city)|sunset(?!-skyline)|clouds|sea)/u;

export function isSkyOnlyImage(id: string | undefined): boolean {
  return !!id && SKY_ONLY.test(id) && !/city|skyline/u.test(id);
}

/** 오프닝 장면 하나가 «장소»를 보이는가: 맵 그대로(map-view)·장소 스틸·올린 그림이면 그렇다, 하늘 층·글 장면뿐이면 아니다. */
function sceneImages(scene: Obj): string[] {
  if (scene.kind === "image" || scene.kind === "video") {
    const layers = (((scene.direction as Obj | undefined)?.layers as Obj[] | undefined) ?? []).map((l) => String(l.resourceId ?? ""));
    return [String(scene.resourceId ?? ""), ...layers].filter(Boolean);
  }
  if (scene.kind === "animatic") {
    const layers = (((scene.composition as Obj | undefined)?.layers as Obj[] | undefined) ?? []);
    return layers.filter((l) => l.kind === "image" && (l.role === "background" || l.role === undefined)).map((l) => String(l.resourceId ?? "")).filter(Boolean);
  }
  return [];
}

/**
 * 오프닝에 장소가 한 번도 안 나온다(2026-10-25 판정 J24·J65): 약초 숲 오프닝은 노을·밤·맑은 하늘 층 셋, 공포 저택은 밤하늘·별 층과
 * 어두운 상자, 폐교는 별이 뜬 하늘뿐이었다. 플레이어는 어디서 무슨 일이 나는지 모른 채 시작한다. 장면 하나 이상이 그 게임의 장소
 * (맵 그대로 map-view·장소 스틸·올린 그림)를 보여야 한다.
 */
export function openingWithoutPlace(project: Project): ShipBlocker[] {
  const op = (project.system as unknown as Obj).opening as Obj | undefined;
  if (!op || op.enabled === false) return [];
  const scenes = ((op.scenes as Obj[] | undefined) ?? []);
  // 글만 있는 프롤로그(그림 장면 0개)는 따로 고른 연출이다 — 그림을 깐 오프닝만 본다.
  if (!scenes.some((sc) => sceneImages(sc).length)) return [];
  const placeShot = scenes.some((sc) => sceneImages(sc).some((id) => !isSkyOnlyImage(id) && id !== "oprn-title-field"));
  if (placeShot) return [];
  const used = [...new Set(scenes.flatMap(sceneImages))];
  const firstMap = project.maps[project.startMapId];
  return [{
    id: "opening-no-place",
    message: `오프닝 ${scenes.length}장면이 하늘·별·구름 같은 일반 배경(${used.slice(0, 4).join(", ")})만 보이고 이 게임의 장소가 한 번도 안 나온다 — 어디서 일이 나는지 모른 채 시작한다. `
      + `이 게임의 장소를 맵 위 엔진 무대로 보인다: author_opening_stage{mapId:'${firstMap?.id ?? "<무대 맵 id>"}', x, y, beats}(${firstMap?.name ?? "무대"}의 대표 자리 — 건물 정문·광장 — 에서 인물이 걷고 말한다). `
      + `맞는 장소 스틸이 있으면 list_opening_media{kind:'image', query:<장소 낱말>} 로 골라 그 장면에 쓴다. 하늘 층은 장소 장면 뒤 겹으로만. 인물 없는 맵 조각만 잘라 붙인 컷은 화면 검수가 오프닝으로 받지 않는다.`,
    evidence: `opening images=${used.join(",") || "none"}`,
  }];
}

/** 그림 설명·태그가 말하는 계절·풍토 낱말 — 요청·게임 글에 같은 계열 낱말이 없으면 «다른 이야기 그림»이다. */
// story = 청사진 이야기·부제처럼 긴 글에 쓰는 좁은 낱말(「눈을 떴다」의 눈은 겨울이 아니다). 없으면 premise.
const SETTING_WORDS: readonly { readonly key: string; readonly art: RegExp; readonly premise: RegExp; readonly story?: RegExp }[] = [
  { key: "눈·겨울", art: /눈 덮인|설원|겨울|눈 쌓인|winter|snow|얼음|오로라/iu, premise: /눈|겨울|설원|얼음|빙|크리스마스|winter|snow|ice/iu,
    story: /눈보라|눈 덮|눈 쌓|눈이 내|눈 내리|눈발|눈송이|폭설|겨울|설원|빙판|얼음|크리스마스|winter|snow/iu },
  { key: "사막", art: /사막|모래|피라미드|desert|오아시스/iu, premise: /사막|모래|피라미드|오아시스|desert/iu },
  { key: "바다·해저", art: /해저|바다|항구|ocean|harbor/iu, premise: /바다|해저|항구|섬|배를|해변|ocean|sea|harbor/iu },
];

function artText(id: string | undefined): string {
  if (!id) return "";
  const still = findOpeningStillMood(id);
  if (still) return `${still.name} ${still.description} ${still.tags.join(" ")}`;
  return id === "oprn-title-field" ? "별빛 아래 눈 덮인 산과 소나무, 등불 켜진 눈 마을(편집기 기본 타이틀)" : "";
}

/**
 * 타이틀·엔딩 그림이 이야기와 다른 곳이다(2026-10-25 판정 J10·J17): 약초 숲 JRPG 타이틀에 눈 내리는 기본 마을, 서울 연애 엔딩 셋이
 * 눈 덮인 산골 마을(엔딩 그림이 비어 타이틀 그림을 이어 썼다). 그림 설명의 계절·풍토 낱말이 요청·게임 글에 없으면 짚는다.
 */
export function offPremiseArt(project: Project, task: string): ShipBlocker[] {
  const s = project.system as unknown as Obj;
  const title = (s.titleScreen ?? {}) as Obj;
  const titleBg = (title.backgroundResourceId ?? s.titleResourceId) as string | undefined;
  // 청사진 이야기·타이틀 부제도 이야기다 — 조립(applyBlueprintAssembly)이 청사진 글로 타이틀 그림을 고르니 검사도 같은 글을 본다
  // (2026-10-29 standin 추리 「눈보라에 갇힌 겨울밤 시골 여관」: 조립이 눈 마을을 골랐는데 요청 글에 눈이 없다고 막았다).
  const premise = [task, project.meta.title, String(title.title ?? ""), ...(project.endings ?? []).map((e) => e.name), ...Object.values(project.maps).map((m) => m.name)].join(" ");
  const story = [String(title.logoSubtitle ?? ""), project.gameBlueprint ? blueprintStoryText(project, project.gameBlueprint) : ""].join("\n");
  const clash = (id: string | undefined): string | undefined => {
    const text = artText(id);
    return SETTING_WORDS.find((w) => w.art.test(text) && !w.premise.test(premise) && !(w.story ?? w.premise).test(story))?.key;
  };
  const out: ShipBlocker[] = [];
  // 편집기 기본 타이틀 그림은 title-image 가 이미 짚는다.
  const tKey = titleBg === "oprn-title-field" ? undefined : clash(titleBg);
  if (tKey) out.push({ id: "title-off-premise", message: `타이틀 그림(${titleBg}: ${artText(titleBg).slice(0, 40)}…)이 ${tKey} 풍경인데 이 게임 이야기에는 ${tKey}이 없다 — list_resources{kind:'backdrop', query:<무대 낱말>}·list_opening_media{kind:'image', query:<무대 낱말>} 로 이야기의 장소 그림을 골라 set_title_screen{backgroundResourceId} 로 바꾼다.`, evidence: `title=${titleBg}` });
  const bare = (project.endings ?? []).filter((e) => !e.presentation?.backgroundResourceId);
  const fallKey = clash(titleBg);
  if (bare.length && (fallKey || titleBg === "oprn-title-field")) out.push({ id: "ending-off-premise", message: `엔딩 ${bare.length}개(${bare.slice(0, 3).map((e) => e.name).join("·")})에 마지막 그림이 없어 타이틀 그림(${titleBg})이 깔린다 — ${fallKey ? `${fallKey} 풍경이라 이 이야기와 다르다` : "편집기 기본 눈 마을이다"}. define_ending 의 presentation.backgroundResourceId 에 그 엔딩의 장소 그림(list_resources{kind:'backdrop', query:<장소 낱말>} 에서 가장 가까운 것)을 준다.`, evidence: bare.map((e) => e.id).join(",") });
  for (const e of project.endings ?? []) {
    const key = clash(e.presentation?.backgroundResourceId);
    if (key) out.push({ id: "ending-off-premise", message: `엔딩 「${e.name}」 그림(${e.presentation!.backgroundResourceId})이 ${key} 풍경인데 이야기에는 ${key}이 없다 — 이 엔딩의 장소 그림으로 바꾼다.`, evidence: `${e.id}=${e.presentation!.backgroundResourceId}` });
  }
  return out;
}

/**
 * 제목·엔딩이 기본 시작 칩셋의 고유 지명을 게임 주제로 삼았다(J70, hf2-school-flash: 밤의 학교 공포 게임이 「버들항의 모험」·
 * 엔딩 「모험의 끝」 "버들항의 평화"로 끝났다). 새 프로젝트가 처음부터 들고 있는 칩셋 계열 이름이라 요청에 없으면 모델이 지어낸 것이다.
 * task 는 앞선 요청 메모까지 든 실행 지시문이다 — 같은 대화의 어느 요청이든 그 지명을 말했으면 정당하다.
 */
/** 플레이어에게 보이는 글만 — 문자열 줄과 비트의 text·lines(id·자원 참조는 빼고). */
function shownTexts(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(shownTexts);
  if (v && typeof v === "object") { const o = v as Obj; return [...shownTexts(o.text), ...shownTexts(o.lines)]; }
  return [];
}

const DEFAULT_PLACE_FAMILIES = ["beodeul"] as const;

export function defaultPlaceLeaks(project: Project, task: string): ShipBlocker[] {
  const words = new Set<string>();
  for (const [id, ts] of Object.entries(project.tilesets ?? {})) {
    if (!DEFAULT_PLACE_FAMILIES.some((f) => id.startsWith(f))) continue;
    const head = String((ts as { name?: unknown }).name ?? "").trim().split(/[\s·]+/u)[0] ?? "";
    if (/^[가-힣]{2,}$/u.test(head)) words.add(head);
  }
  const out: ShipBlocker[] = [];
  for (const word of words) {
    if (task.includes(word)) continue;
    const title = String(((project.system as unknown as Obj).titleScreen as Obj | undefined)?.title ?? "");
    const where = [
      ...(title.includes(word) ? [`타이틀 「${title}」`] : []),
      ...(String(project.meta.title ?? "").includes(word) && project.meta.title !== title ? [`프로젝트 제목 「${project.meta.title}」`] : []),
      ...(project.endings ?? []).filter((e) => [e.name, ...shownTexts((e as unknown as Obj).epilogue)].some((t) => t.includes(word))).map((e) => `엔딩 「${e.name}」`),
    ];
    if (where.length) out.push({ id: "default-place-leak", message: `${where.slice(0, 4).join("·")}이 「${word}」을 말하는데 요청에는 ${word}이 없다 — ${word}은 새 프로젝트 기본 칩셋 이름이지 이 게임의 무대가 아니다. 요청한 이야기에서 제목(set_title_screen{title})·엔딩(define_ending)을 다시 짓는다.`, evidence: `${word}: ${where.join(", ").slice(0, 160)}` });
  }
  return out;
}

const squash = (s: string): string => s.replace(/\s+/gu, "").normalize("NFC");

export function titleMismatch(project: Project, task: string): ShipBlocker[] {
  const want = requestedTitle(task);
  if (!want) return [];
  const shown = String(((project.system as unknown as Obj).titleScreen as Obj | undefined)?.title ?? project.meta.title ?? "").trim();
  if (squash(shown) === squash(want)) return [];
  return [{ id: "title-not-requested", message: `요청한 제목은 「${want}」인데 타이틀이 「${shown || "(없음)"}」이다 — set_title_screen{title:"${want}"} 로 요청한 제목을 그대로 쓴다.`, evidence: `want=${want} shown=${shown}` }];
}

/**
 * 오프닝이 꺼졌거나 장면이 하나도 없다 — 게임을 새로 만들었는데 처음 화면에서 곧바로 들판이 열린다(2026-11-09 assistant-reward 기준선: monster-1 이 프리셋 오프닝을 끄고 끝냈다).
 * 기본 장면이 남은 경우(editorDefaultsLeft opening)와 하늘만 보이는 경우(openingWithoutPlace)는 따로 짚는다. 무대(system.opening.stage)가 있으면 장면 없이도 시작이 연출된다.
 */
export function openingMissing(project: Project): ShipBlocker[] {
  const op = (project.system as unknown as Obj).opening as Obj | undefined;
  // 장면은 글이 있거나 그림(resourceId)·애니메틱 구성이 있어야 센다 — 빈 글 장면 둘로 관문을 통과하지 못하게.
  const scenes = ((op?.scenes as Obj[] | undefined) ?? []).filter((sc) => String(sc.narration ?? "").trim() || sc.resourceId || sc.composition).length;
  const staged = !!op?.stage;
  if (op && op.enabled !== false && (scenes >= 2 || staged)) return [];
  return [{
    id: "opening-missing",
    message: `이 게임에는 오프닝이 없다(${!op || op.enabled === false ? "꺼져 있다" : `장면이 ${scenes}개뿐이다(둘 이상 필요)`}) — 새 게임을 누르면 설명 없이 곧바로 필드가 열린다. plan_opening·set_opening 으로 이 게임의 오프닝(장면 둘 이상, 첫 장면부터 이 이야기)을 짓고 {enabled:true} 로 둔다. 맵 위 무대는 author_opening_stage 로도 된다.`,
    evidence: `opening.enabled=${String(op?.enabled)} scenes=${scenes} stage=${staged}`,
  }];
}

/**
 * 타이틀·엔딩 그림이 번들 스틸(오프닝 스틸 카탈로그·번들 타이틀 그림)이다 — 어느 게임이나 고를 수 있는 같은 그림이다.
 * 기본 그림(title-image·ending-bg)뿐 아니라 번들 스틸도 «그 게임의 그림»이 아니다. 게임의 첫 장소 화면(map-view:)·올린 그림·생성 그림으로 바꾼다.
 * 연애 키아트(ROMANCE_TITLE_BACKGROUNDS)는 이 장르 전용으로 만든 그림이라 예외다.
 */
export function bundledPictureLeft(project: Project): ShipBlocker[] {
  const out: ShipBlocker[] = [];
  // 연애 키아트는 «연애 게임»에서만 예외다 — 학교 추리 게임이 엔딩에 oprn-title-romance-school 을 걸어 통과했다(2026-11-09 b1 school-1 재실행).
  const romance = isRomanceTitleTarget(project);
  const bundled = (id: string | undefined): id is string => !!id && isBundledPictureId(id, project) && !(romance && ROMANCE_TITLE_BACKGROUNDS.includes(id));
  // 아직 아무것도 짓지 않은 빈 맵의 화면은 단색이라 «이 게임의 그림»이 아니다 — 맵 화면도 지은 맵이어야 한다.
  const blankView = (id: string | undefined): id is string => { const mapId = openingMapViewMapId(id); const map = mapId ? project.maps[mapId] : undefined; return !!map && blankMap(map); };
  const title = (project.system.titleScreen ?? {}) as { backgroundResourceId?: string };
  const titleBg = title.backgroundResourceId ?? (project.system as unknown as Obj).titleResourceId as string | undefined;
  if (blankView(titleBg)) out.push({ id: "bundled-picture", message: `타이틀 그림이 빈 맵 화면(${titleBg})이다 — 아직 아무것도 짓지 않은 맵은 단색이다. 이 게임의 장소를 지은 뒤 그 맵 화면을 쓰거나 다른 그림을 고른다.`, evidence: `titleScreen.backgroundResourceId=${titleBg}` });
  else if (bundled(titleBg)) out.push({ id: "bundled-picture", message: `타이틀 그림이 번들 스틸(${titleBg})이다 — 어느 게임이나 고를 수 있는 같은 그림이라 이 게임의 그림이 아니다. 이 게임의 시작 장소 화면(map-view:<맵 id>)이나 생성·올린 그림을 set_title_screen{backgroundResourceId} 로 쓴다(list_resources{kind:'backdrop'} 에서 map-view 를 고를 수 있다).`, evidence: `titleScreen.backgroundResourceId=${titleBg}` });
  for (const ending of project.endings ?? []) {
    const shown = endingBackdropCandidates(project, ending.presentation?.backgroundResourceId)[0];
    if (blankView(shown)) { out.push({ id: "bundled-picture", message: `엔딩 「${ending.name || ending.id}」 그림이 빈 맵 화면(${shown})이다 — 아직 아무것도 짓지 않은 맵은 단색이다. 지은 장소의 맵 화면이나 다른 그림을 준다.`, evidence: `endings[${ending.id}].backgroundResourceId=${shown}` }); break; }
    if (!bundled(shown)) continue;
    out.push({ id: "bundled-picture", message: `엔딩 「${ending.name || ending.id}」 그림이 번들 스틸(${shown})이다 — 어느 게임이나 고를 수 있는 같은 그림이다. define_ending 의 presentation.backgroundResourceId 에 이 게임의 장소 화면(map-view:<맵 id>)이나 생성·올린 그림을 준다.`, evidence: `endings[${ending.id}].backgroundResourceId=${shown}` });
    break;
  }
  return out;
}
