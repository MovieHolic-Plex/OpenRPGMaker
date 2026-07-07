// 학습 예시 맵 12종 — AI(및 개발자)에게 지붕/집/마을 구성을 가르치기 위한 캔버스.
// 사용자가 각 맵에 손수 예시 타일을 채워넣고, 그 결과를 학습 프레임워크의 정답 데이터로 쓴다.
// 맵은 잔디 바닥만 깔린 상태로 시작하며, 이름이 곧 "여기에 무엇을 채워야 하는가"의 주제다.
import { genId } from "@/util/id";
import type { GameMap } from "../types";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";

const TOWN_GRASS = 270;

interface TrainingMapSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

// 주제 구성: 지붕 세트별(오렌지/파랑/사선) → 집 유형별 → 마을/자연 → 자유.
const TRAINING_MAP_SPECS: readonly TrainingMapSpec[] = [
  { name: "연습01 지붕 — 오렌지 직선(용마루·몸통·처마)", width: 20, height: 15 },
  { name: "연습02 지붕 — 파랑 직선", width: 20, height: 15 },
  { name: "연습03 지붕 — 사선 오버레이(상위 레이어)", width: 20, height: 15 },
  { name: "연습04 지붕 — 혼합·특수(굴뚝/창 포함)", width: 20, height: 15 },
  { name: "연습05 집 — 1층 회벽", width: 20, height: 15 },
  { name: "연습06 집 — 통나무", width: 20, height: 15 },
  { name: "연습07 집 — 2층", width: 20, height: 15 },
  { name: "연습08 집 — ㄱ자/변형 평면", width: 24, height: 18 },
  { name: "연습09 마을 — 집 배치와 길", width: 30, height: 20 },
  { name: "연습10 자연 — 강·다리·나무", width: 24, height: 18 },
  { name: "연습11 소품 — 울타리·우물·시장", width: 20, height: 15 },
  { name: "연습12 자유 실험", width: 20, height: 15 },
];

function createTrainingMap(spec: TrainingMapSpec): GameMap {
  const n = spec.width * spec.height;
  return {
    id: genId("map"),
    name: spec.name,
    width: spec.width,
    height: spec.height,
    tilesetId: DEFAULT_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(n).fill(TOWN_GRASS),
    upperTiles: new Array<number>(n).fill(TILE.EMPTY),
    events: [],
  };
}

export function createTrainingExampleMaps(): GameMap[] {
  return TRAINING_MAP_SPECS.map(createTrainingMap);
}
