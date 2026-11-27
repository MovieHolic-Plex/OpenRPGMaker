// 신규 맵 생성 직후 스토어 음악 팩에서 장면·장르·분위기에 맞는 BGM 1곡만 자동 선택·설치·배정한다.
//
// 왜:
//   - 로컬 281곡 CC0 팩(1.3GB)을 받지 않아도 에셋 스토어(609곡, 전곡 oprnMusic 메타)에서
//     맵 종류(town·field·dungeon)와 세계/장르(조선·무협·호러·현대·SF·판타지 5계열 등)에 맞는 곡을 바로 붙인다.
//   - 추가 LLM 턴·토큰 없이 5분 캐시(loadStoreMusic) + 1곡 subset 다운로드(prepareFromWorker)만 쓴다.
//   - 동점·근접 상위 후보 풀에서 시드(프로젝트+맵)로 분산 선택해 매번 0번 곡만 반복되는 편중을 막고,
//     한 게임 안에서는 이미 넣은 스토어 곡 줄(projectMusicLines)을 따라 톤 일관성을 유지한다.
//   - 사용자가 「넣기 전에 먼저 묻기」(autoInstall=false)를 켰거나, 스토어 미연결·오프라인이면
//     아무것도 설치하지 않고 기존 내장 BGM(recommendMapBgm)을 그대로 둔다.
//   - 설치한 곡과 다음 후보 3곡을 StoreMusicChoice(autoInstall:true) tool_end 로 내보내
//     채팅 패널에 「넣었어요: 곡 제목 (바꾸기)」 쪽지 카드를 띄운다.

import { storeProjectId } from "@/assetStore/format";
import { applyPackToProject } from "@/assetStore/pack";
import { workerStoreAccess } from "@/assetStore/storeAccess";
import {
  briefStoreMusic,
  expandStoreMusicQuery,
  explainStoreMusicPick,
  inferStoreMusicScene,
  projectHintLines,
  projectMusicLines,
  scoreStoreMusic,
  type StoreMusicQuery,
  type StoreMusicTrack,
} from "@/assetStore/storeMusicPick";
import type { StoreMusicScene } from "@/assets/storeMusicMeta";
import { addStoreProfiles } from "@/editor/assetStore/storeProfiles";
import { loadStoreMusic, prepareFromWorker, type StoreMusicChoice } from "@/editor/tools/storeTools";
import { blueprintPremiseText } from "@/project/blueprintAssembly";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import type { PiAssistantV2Env } from "../shared/env";
import type { PlaceSpec } from "../shared/types";

const STORE_LOAD_TIMEOUT_MS = 8_000;
const STORE_BLOB_TIMEOUT_MS = 12_000;
/** 1위 점수와 이 차이 이내인 최상위 후보 풀에서 시드로 1곡을 골라 매번 0번 곡만 반복되는 편중을 막는다. */
const TOP_BAND_DELTA = 1.5;
const TOP_BAND_CAP = 12;

export interface AutoStoreBgmMapHint {
  readonly specType?: PlaceSpec["type"] | "field" | "forest";
  readonly kind?: string;
  readonly indoor?: boolean;
  readonly danger?: boolean;
}

export interface AutoStoreBgmAssigned {
  readonly mapId: string;
  readonly mapName: string;
  readonly resourceId: string;
  readonly title: string;
  readonly slug: string;
  readonly assetId: string;
  readonly scene: StoreMusicScene;
}

const DUNGEON_NAME_RE = /던전|동굴|유적|지하|미궁|폐광|광산|탑|묘실|감옥|하수도|소굴|신전\s*내부|dungeon|cave|cavern|ruin|mine|crypt|sewer|lair|tower/iu;
const FIELD_NAME_RE = /숲|들판|초원|필드|평원|설원|고갯길|황무지|사막|해안|바닷가|섬|밀림|정글|산길|오솔길|성운|우주|외곽|섹터|행성|탐사|forest|woods|field|meadow|plains|snow|desert|coast|island|jungle|trail|route|sector|nebula|orbit|space/iu;
const TOWN_NAME_RE = /마을|도시|거리|상점가|광장|성|항구|여관|가게|상점|집|방|교실|학교|캠퍼스|사무실|카페|병원|미술관|갤러리|저택|궁궐|객잔|도장|기숙사|village|town|city|street|square|harbor|port|inn|shop|house|room|school|campus|office|cafe|gallery|museum|mansion|dorm/iu;

/** 일반 판타지 프로젝트가 15곡짜리 기본 fantasy 팩 하나에만 쏠리지 않도록 프로젝트 시드로 한 줄을 고른다. */
const PEACEFUL_FANTASY_PALETTES = [
  "판타지",
  "심포닉 판타지",
  "16비트 레트로",
  "오케스트라 멜로드라마",
] as const;

const DARK_FANTASY_PALETTES = [
  "다크 포크 판타지",
  "심포닉 판타지",
  "오케스트라 멜로드라마",
  "판타지",
] as const;

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const out = hash >>> 0;
  return out === 0 ? 1 : out;
}

/** 맵의 종류·역할·이름에서 스토어 음악 장면(town | field | dungeon)을 추론한다. */
export function inferMapStoreScene(map: Pick<GameMap, "name" | "mapRole">, hint?: AutoStoreBgmMapHint): StoreMusicScene {
  if (hint?.specType === "dungeon" || hint?.specType === "cave" || hint?.danger === true || map.mapRole === "dungeon") {
    return "dungeon";
  }
  if (hint?.specType === "interior" || hint?.indoor === true) {
    if (DUNGEON_NAME_RE.test(map.name ?? "")) return "dungeon";
    return "town";
  }
  if (hint?.specType === "village") return "town";
  if (hint?.specType === "field" || map.mapRole === "field") return "field";
  const name = map.name ?? "";
  if (DUNGEON_NAME_RE.test(name)) return "dungeon";
  if (TOWN_NAME_RE.test(name)) return "town";
  if (FIELD_NAME_RE.test(name)) return "field";
  const inferred = inferStoreMusicScene(name, hint?.kind ?? "");
  if (inferred === "dungeon" || inferred === "field" || inferred === "town") return inferred;
  return "town";
}

export interface TilesetMusicHint {
  readonly genre: string;
  readonly mood: string;
}

/** 타일셋 id·계열에서 스토어 음악 장르·분위기 힌트를 뽑는다. 일반 판타지 칩셋은 프로젝트 시드로 5개 판타지 줄에 분산한다. */
export function tilesetMusicHint(
  tilesetId: string | undefined,
  tilesetFamily: string | undefined,
  projectSeed = 1,
  darkOrDungeon = false,
): TilesetMusicHint {
  const id = (tilesetId ?? "").toLowerCase();
  const fam = (tilesetFamily ?? "").toLowerCase();
  if (id.includes("joseon")) return { genre: "조선", mood: "" };
  if (id.includes("murim") || id.includes("wuxia")) return { genre: "무협", mood: "" };
  if (id.includes("gothic") || id.includes("horror")) return { genre: "호러", mood: "으스스 어두운 긴장" };
  if (id.includes("sf_station") || id.includes("scifi")) return { genre: "SF", mood: "우주 미래" };
  if (id.includes("modern_campus")) return { genre: "현대", mood: "" };
  if (id.includes("modern_city") || id.includes("jp_city") || id.includes("modern")) return { genre: "현대", mood: "도시 거리" };
  if (fam.startsWith("oprn-monster") || id.includes("monster")) return { genre: "몬스터", mood: "모험 경쾌" };
  if (id.includes("wizarding")) return { genre: "심포닉", mood: "신비 마법 웅장" };
  if (id.includes("steampunk")) return { genre: "오케스트라 멜로드라마", mood: "기계 시계 웅장" };
  if (id.includes("snow_north")) return { genre: "심포닉", mood: "설원 겨울 차가운 웅장" };
  if (id.includes("desert_east")) return { genre: "다크 포크 판타지", mood: "사막 이국적 모험" };
  if (id.includes("pirate_isles")) return { genre: "심포닉", mood: "바다 항구 모험 경쾌" };
  if (id.includes("sky_island")) return { genre: "심포닉", mood: "하늘 몽환 신비" };
  if (id.includes("wasteland")) return { genre: "호러", mood: "황무지 폐허 쓸쓸 어두운 고독" };
  if (id.includes("sengoku") || id.includes("edo")) return { genre: "조선 무협", mood: "동양" };
  if (id.includes("beodeul") || id.includes("hand_interior") || id.includes("prehistoric")) {
    const palettes = darkOrDungeon ? DARK_FANTASY_PALETTES : PEACEFUL_FANTASY_PALETTES;
    const picked = palettes[Math.abs(projectSeed) % palettes.length]!;
    return { genre: picked, mood: darkOrDungeon ? "어두운 긴장 신비" : "" };
  }
  return { genre: "", mood: "" };
}

/** 호환용 래퍼 — 타일셋의 장르 문자열만 반환한다. */
export function tilesetMusicGenreHint(tilesetId: string | undefined, tilesetFamily: string | undefined): string {
  return tilesetMusicHint(tilesetId, tilesetFamily, 1, false).genre;
}

/** 요청·청사진에서 장르 줄·게임 느낌에 직접 대응하는 낱말만 추출한다. */
const GENRE_STYLE_RE = /학교\s*(?:공포|괴담)|다크\s*(?:판타지|포크)|잔혹\s*동화|조선|무협|무림|판타지|호러|공포|무서|괴담|으스스|오싹|폐교|교실|미술관|갤러리|현대|몬스터|포켓몬|연애|일상|sf|우주|16비트|레트로|칩튠|8비트|심포닉|오케스트라|피아노|멜로드라마|몽환|기묘|joseon|wuxia|fantasy|horror|school\s*horror|classroom|gallery|museum|modern|monster|romance|scifi|sci-fi|16-?bit|retro|chiptune|8-?bit|symphonic|orchestra|piano|dark\s*folk|dream|eerie/giu;
const EXPLICIT_GENRE_RE = /조선|무협|무림|호러|공포|무서|괴담|으스스|오싹|폐교|미술관|갤러리|현대|몬스터|포켓몬|연애|일상|sf|우주|16비트|레트로|칩튠|8비트|심포닉|오케스트라|피아노|멜로드라마|다크\s*포크|잔혹\s*동화|몽환|기묘|joseon|wuxia|horror|gallery|museum|modern|monster|romance|scifi|sci-fi|16-?bit|retro|chiptune|8-?bit|symphonic|orchestra|piano/iu;
/** 곡의 mood·feelTags·summaryKo 와 대조할 분위기·바이옴 낱말(query가 아닌 mood로 넘겨 장르 감점을 피한다). */
const MOOD_BIOME_RE = /평화|따뜻|밝은|활기|경쾌|신나는|잔잔|고요|쓸쓸|슬픈|애절|서정|웅장|장엄|비장|신비|몽환|기묘|긴장|으스스|오싹|어두운|어둡|불안|설원|겨울|얼음|사막|오아시스|바다|항구|해적|숲|초원|하늘|밤|저녁|안개|폐허|황무지|마법|시계|증기|기계|유적|지하|동굴|고대|peaceful|calm|warm|bright|cheerful|melancholic|sad|epic|grand|mysterious|dreamy|tense|eerie|dark|snow|winter|desert|ocean|harbor|pirate|forest|magic|clock|steam|ancient/giu;

/** 요청·청사진·맵 이름에서 장르 query 와 분위기 mood 를 분리해 조립한다. */
export function buildAutoMusicWant(
  hint: TilesetMusicHint,
  taskText: string,
  blueprintText: string,
  mapName: string,
  hasStoredLine: boolean,
): { readonly query: string; readonly mood: string; readonly hasExplicitGenre: boolean } {
  const source = `${taskText} ${blueprintText} ${mapName}`;
  const games = expandStoreMusicQuery(source).games;
  const styleWords = source.match(GENRE_STYLE_RE) ?? [];
  // 일반 "판타지" 한 단어만 말한 경우는 구체적 판타지 결(심포닉·16비트·멜로드라마·다크포크)이 타일셋/시드에서 합류할 수 있게 열어 둔다.
  const hasSpecificGenre = games.length > 0 || EXPLICIT_GENRE_RE.test(source);
  const genreFallback = hasSpecificGenre || hasStoredLine ? [] : hint.genre.split(/\s+/u);
  // 구체적 판타지 결(심포닉 등)이 합류할 때 중복되는 "판타지"만 넣으면 fantasy(15곡)가 +6을 독식하므로,
  // 타일셋/시드가 구체적 하위 판타지 줄(심포닉·16비트·멜로드라마·다크 포크)을 골랐으면 단독 "판타지" 토큰은 생략한다.
  const subFantasyChosen = !hasSpecificGenre && !hasStoredLine && /심포닉|16비트|멜로드라마|다크\s*포크/u.test(hint.genre);
  const filteredStyles = subFantasyChosen
    ? styleWords.filter((w) => !/^(?:판타지|fantasy)$/iu.test(w.trim()))
    : styleWords;
  const queryParts = [...new Set([...games, ...filteredStyles, ...genreFallback].map((s) => s.trim()).filter(Boolean))];
  const moodWords = source.match(MOOD_BIOME_RE) ?? [];
  const moodParts = [...new Set([...moodWords, ...hint.mood.split(/\s+/u)].map((s) => s.trim()).filter(Boolean))];
  return {
    query: queryParts.join(" "),
    mood: moodParts.join(" "),
    hasExplicitGenre: hasSpecificGenre,
  };
}

/**
 * 상위 동점·근접 풀(1위 대비 TOP_BAND_DELTA 이내) 안에서 시드로 1위 곡을 고르고,
 * 나머지 최상위 후보를 뒤따라 붙여 「바꾸기」 선택지로 돌려준다.
 */
export function pickSeededStoreTracks(
  tracks: readonly StoreMusicTrack[],
  want: StoreMusicQuery,
  seedKey: string,
  limit = 4,
): StoreMusicTrack[] {
  const scored = tracks
    .map((track, index) => ({ track, index, score: scoreStoreMusic(track, want) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (!scored.length) return [];
  const best = scored[0]!.score;
  const band = scored.filter((row) => best - row.score <= TOP_BAND_DELTA).slice(0, TOP_BAND_CAP);
  const rng = mulberry32(fnv1a32(seedKey));
  const winnerIdx = band.length > 1 ? Math.floor(rng() * band.length) : 0;
  const winner = band[winnerIdx]!;
  const rest = scored.filter((row) => row.track !== winner.track).slice(0, Math.max(0, limit - 1));
  return [winner.track, ...rest.map((row) => row.track)];
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`store-bgm-timeout:${ms}ms`)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function usedMapBgmIds(project: Project, skipMapId?: string): Set<string> {
  const used = new Set<string>();
  for (const map of Object.values(project.maps)) {
    if (map.id === skipMapId || map.bgm?.mode !== "custom") continue;
    const id = map.bgm.resourceId?.trim();
    if (id) used.add(id);
  }
  return used;
}

/** 맵이 자동 배정 대상인가 — 명시 무음(none)이거나 이미 업로드/스토어 곡이 걸려 있으면 건드리지 않는다. */
function isAutoBgmEligible(project: Project, map: GameMap | undefined): map is GameMap {
  if (!map) return false;
  if (map.bgm?.mode === "none") return false;
  if (map.bgm?.mode === "custom" && map.bgm.resourceId && Object.hasOwn(project.assets.uploaded, map.bgm.resourceId)) {
    return false;
  }
  return true;
}

function buildStoreMusicChoice(
  mapName: string,
  scene: StoreMusicScene,
  picked: readonly StoreMusicTrack[],
  want: StoreMusicQuery,
): StoreMusicChoice {
  const need = `「${mapName}」 맵 BGM`;
  return {
    kind: "store-music-choice",
    need,
    scene,
    autoInstall: true,
    tracks: picked.map((track, index) => {
      const told = explainStoreMusicPick(track, want);
      return {
        ...briefStoreMusic(track),
        version: track.version,
        blob: track.blob,
        rank: index + 1,
        ...(index === 0 ? { recommended: true } : {}),
        why: told.why,
        ...(told.fallback ? { fallback: true } : {}),
      };
    }),
  };
}

/**
 * 새로 지은 맵들에 스토어 음악 팩에서 장면·장르·분위기에 맞는 곡을 1곡씩 자동 설치·배정하고,
 * 채팅 UI가 「넣었어요: 곡 제목 (바꾸기)」 쪽지 카드를 띄울 수 있도록 tool_end 이벤트를 보낸다.
 * 스토어 미연결·오프라인·먼저 묻기(autoInstall=false)에서는 아무것도 바꾸지 않고 빈 배열을 돌려준다.
 */
export async function assignStoreBgmToNewMaps(
  env: PiAssistantV2Env,
  mapIds: readonly string[],
  options?: {
    readonly hints?: Readonly<Record<string, AutoStoreBgmMapHint>>;
    readonly task?: string;
  },
): Promise<AutoStoreBgmAssigned[]> {
  const access = workerStoreAccess();
  if (!access || access.autoInstall !== true) return [];
  const project = env.ctx.project;
  const targets = [...new Set(mapIds)]
    .map((id) => project.maps[id])
    .filter((map): map is GameMap => isAutoBgmEligible(project, map));
  if (!targets.length) return [];

  let allTracks: StoreMusicTrack[];
  try {
    allTracks = await withTimeout(loadStoreMusic(access, ""), STORE_LOAD_TIMEOUT_MS);
  } catch {
    return [];
  }
  if (!allTracks.length) return [];

  const taskText = String(options?.task ?? env.request.task ?? "");
  const blueprintText = project.gameBlueprint
    ? [blueprintPremiseText(project, project.gameBlueprint), project.gameBlueprint.world ?? ""].filter(Boolean).join(" ")
    : "";
  const projectSeed = fnv1a32(String(env.request.projectKey ?? project.meta?.title ?? project.startMapId ?? targets[0]?.id ?? "oprn"));
  const usedIds = usedMapBgmIds(project);
  const assigned: AutoStoreBgmAssigned[] = [];

  for (const map of targets) {
    try {
      const hint = options?.hints?.[map.id];
      const scene = inferMapStoreScene(map, hint);
      const tileset = project.tilesets[map.tilesetId];
      const darkOrDungeon = scene === "dungeon" || /어두운|어둡|황무지|폐허|저주|암흑|dark|cursed/iu.test(`${taskText} ${map.name ?? ""}`);
      const tsHint = tilesetMusicHint(map.tilesetId, tileset?.family, projectSeed, darkOrDungeon);
      const storedLines = projectMusicLines(project.assets.uploaded);
      const hasStoredLine = Object.keys(storedLines).length > 0;
      const { query, mood, hasExplicitGenre } = buildAutoMusicWant(tsHint, taskText, blueprintText, map.name ?? "", hasStoredLine);
      const projectLines = hasStoredLine
        ? storedLines
        : projectHintLines([project.meta?.title ?? "", blueprintText, taskText, map.name ?? "", ...(hasExplicitGenre ? [] : [tsHint.genre])]);
      const want: StoreMusicQuery = { scene, query, ...(mood ? { mood } : {}), projectLines };
      const seedKey = `${projectSeed}:${map.id}:${map.name ?? ""}`;

      // 다른 맵에 이미 배정된 곡은 제외하고 루프 가능한 곡을 우선한다.
      const unused = allTracks.filter((t) => !usedIds.has(storeProjectId(t.slug, t.assetId)));
      const loopUnused = unused.filter((t) => t.music.loopable);
      let picked = pickSeededStoreTracks(loopUnused, want, seedKey, 4);
      if (!picked.length) picked = pickSeededStoreTracks(unused, want, seedKey, 4);
      if (!picked.length) picked = pickSeededStoreTracks(allTracks.filter((t) => t.music.loopable), want, seedKey, 4);
      const top = picked[0];
      if (!top) continue;

      const resourceId = storeProjectId(top.slug, top.assetId);
      if (!Object.hasOwn(project.assets.uploaded, resourceId)) {
        const prepared = await withTimeout(prepareFromWorker(access, top.slug, [top.assetId]), STORE_BLOB_TIMEOUT_MS);
        const applied = applyPackToProject(project, prepared.manifest, prepared.context);
        addStoreProfiles(project, applied.assetIds);
      }

      map.bgm = { mode: "custom", resourceId };
      usedIds.add(resourceId);

      const title = top.titleKo || top.name;
      const choice = buildStoreMusicChoice(map.name || map.id, scene, picked, want);
      const summary = `「${map.name || map.id}」 맵 BGM으로 스토어 곡 「${title}」을(를) 넣었습니다.`;
      env.emit({
        type: "tool_end",
        id: `auto-store-bgm:${map.id}`,
        name: "store_find_music",
        ok: true,
        summary,
        result: { ok: true, summary, data: choice },
      });
      assigned.push({ mapId: map.id, mapName: map.name || map.id, resourceId, title, slug: top.slug, assetId: top.assetId, scene });
    } catch {
      // 개별 맵의 스토어 다운로드·매칭 실패는 기존 내장 BGM으로 조용히 폴백한다.
    }
  }

  return assigned;
}
