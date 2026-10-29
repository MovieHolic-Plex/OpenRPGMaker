/**
 * 『폴른 스타』 2막 B5·B6·얼음 호수 — 되살린 버들항 웨이브 장소(원본 그림을 16px 칸으로 자른 공용 장소)를 그대로 쓴다.
 *
 * 왜(2026-10-29 사용자 결정): 기획 그림(fs-act2-plan.html)의 새벽샘 터·얼음 호수·재의 들판·관문 요새를 「개잘만든 거니까 어떻게든 살려」.
 * 웨이브 장소 그림은 3/4 관문(object-gate)을 통과하지 못했지만(199조각 중 39), 원본을 그대로 자른 것이라 이번에 한해 예외로 바로 쓴다 —
 * 데모 브랜치에만 넣고 다시 그리거나 고치지 않는다. 장소는 조수와 같은 import_region_reference 로 가져온다(칸 배열을 손으로 옮기지 않는다).
 *
 *   재의 들판  map_field_north_2 ← bd-wave-ash-plain        (72×21, 화산 지대 필드의 남쪽 재 평원)
 *   새벽샘 터  fs2_dawnwell      ← bd-wave-ruined-village   (64×48, 불탄 폐허 마을)
 *   관문 요새  fs2_fort_court    ← bd-wave-mountain-fortress(72×56, 산길 → 도개교 → 성문 → 앞뜰 → 거대 석문)
 *   얼음 호수  fs2_ice_lake      ← bd-wave-ice-age-field    (72×52, 눈보라 고개 → 언 호수 얼음 다리 → 빙벽 얼음 굴 → 서리나루)
 *
 * 아래 칸은 모두 장소 원본 좌표다(가져올 때 칸이 바뀌지 않는다). 걷기 칸·닿음은 짓는 쪽(act2Opening.ts)이 canMove BFS 로 다시 확인한다.
 */
import wavePlaces from "@/project/regionReferences/beodeul-wave-places.json";
import { primeRegionReferenceSnapshot } from "@/project/regionReferenceSnapshots";

type Cell = { x: number; y: number };

/** 웨이브 장소 스냅숏을 미리 넣는다 — 데모 빌더는 동기라 import_region_reference 가 「불러오는 중」으로 거절하지 않게. */
export function primeWavePlaces(): void {
  primeRegionReferenceSnapshot("bd-wave-ash-plain", wavePlaces);
}

export const WAVE_ASH_PLAIN = "bd-wave-ash-plain";
export const WAVE_RUINED_VILLAGE = "bd-wave-ruined-village";
export const WAVE_MOUNTAIN_FORTRESS = "bd-wave-mountain-fortress";
export const WAVE_ICE_AGE_FIELD = "bd-wave-ice-age-field";

/** 재의 들판(72×21) — 남쪽 입구 오솔길 → 북쪽 끝 오솔길. 서쪽 그을린 고목 숲·짐승 뼈, 가운데 주상절리·흑요석, 동쪽 유황 분기공 벌판. */
export const ASH_SPOTS = {
  entry: { x: 35, y: 20 } as Cell, north: { x: 35, y: 0 } as Cell,
  // 도깨비 — 서쪽 고목 숲 어귀. 재뱀 — 흑요석 가시 사이. 골렘 — 동쪽 유황 벌판의 짐 상자 앞(비켜 갈 수 있는 정예).
  wisps: { x: 26, y: 11 } as Cell, snakes: { x: 46, y: 15 } as Cell, golem: { x: 59, y: 9 } as Cell, chest: { x: 62, y: 6 } as Cell,
};

/** 새벽샘 터(64×48) — 남쪽 문기둥 입구, 판석 광장(마른 우물), 북쪽 무너진 예배당, 둘레의 반쯤 무너진 집 여섯. */
export const DAWN_SPOTS = {
  entry: { x: 31, y: 47 } as Cell, north: { x: 39, y: 0 } as Cell,
  // 바깥에서 잠긴 집 — 광장 남동쪽 돌집(지붕이 남은 단 한 채). 문 칸(44,38)은 집 맨 아랫줄, 문 앞(44,39).
  kept: { x: 42, y: 33, w: 4, h: 6 }, front: { x: 44, y: 39 } as Cell,
  wisps: { x: 12, y: 33 } as Cell, save: { x: 28, y: 45 } as Cell,
  // 기억 셋 — 마른 우물 남쪽, 불탄 예배당 잔해 곁, 서쪽 길 한가운데.
  mems: [{ x: 30, y: 27 }, { x: 37, y: 18 }, { x: 20, y: 33 }] as Cell[],
};

/**
 * 관문 요새 바깥(72×56). 남쪽 산길 → 지그재그 오르막(돌계단 둘) → 골짜기 위 도개교 → 성문(쇠창살) → 앞뜰 → 거대 석문.
 * 성문은 쇠창살이 내려져 있어 도개교 꼭대기에서 성문 망루(요새 안 던전)로 들어간다. 던전 2층 성벽 문을 나오면 앞뜰 서쪽 망루 위 —
 * 앞뜰은 성벽 위 높이라 그대로 「성벽 위 결투장」이다. 새라는 성벽 문으로 나온 자리 바로 앞 성벽 길을 막아서 그 자리에서 싸운다. 이기면 석문이 열려 서리 가도로 간다.
 */
export const COURT_SPOTS = {
  entry: { x: 14, y: 55 } as Cell,
  /** 도개교 꼭대기(성문 쇠창살 바로 앞) 세 칸 — 요새 안(던전 1층)으로 들어가는 문. 가운데가 던전 입구 연결, 양옆은 같은 이동. */
  gate: [{ x: 35, y: 20 }, { x: 34, y: 20 }, { x: 36, y: 20 }] as Cell[],
  /** 성문 쇠창살(앞뜰 쪽에서 내려가지 못하게 막는다). */
  portcullis: [{ x: 34, y: 18 }, { x: 35, y: 18 }, { x: 36, y: 18 }] as Cell[],
  /** 거대 석문 문짝 두 칸과 그 앞 칸. */
  door: [{ x: 35, y: 11 }, { x: 36, y: 11 }] as Cell[], doorFront: [{ x: 35, y: 12 }, { x: 36, y: 12 }] as Cell[],
  /** 서리 가도에서 돌아오면 서는 칸(석문 앞 두 줄 아래). */
  north: { x: 35, y: 13 } as Cell,
  /** 던전 2층 성벽 문으로 나오면 서는 칸(서쪽 망루 앞)과 다시 들어가는 망루 칸. */
  arrive: { x: 17, y: 15 } as Cell, tower: { x: 17, y: 16 } as Cell,
  /** 새라는 성벽 문으로 나온 자리(arrive) 두 칸 앞 성벽 길을 막아선다 — 나오자마자 그 자리에서 싸운다(2026-10-30 사용자). 경비견은 그 뒤. */
  sarah: { x: 19, y: 15 } as Cell, dog: { x: 20, y: 15 } as Cell,
  /** 바깥 적 — 경비견은 가운데 단 길, 순찰 기사는 도개교 앞 눈 턱을 가로로 오간다. */
  dogs: { x: 44, y: 40 } as Cell, knight: { x: 28, y: 28 } as Cell,
};

/** 얼음 호수(72×52) — 남쪽 모피 천막 야영지 → 언 호수(얼음 다리로 검은 물길을 건넘) → 북쪽 빙벽 얼음 굴 → 서리나루 남쪽 어귀. */
export const FS2_ICE_LAKE_ID = "fs2_ice_lake";
export const ICE_SPOTS = {
  entry: { x: 35, y: 51 } as Cell,
  cave: [{ x: 45, y: 10 }, { x: 46, y: 10 }] as Cell[],
  // 서리늑대 — 서쪽 눈 전나무 숲 가장자리. 박쥐 떼 — 언 호수 위. 늑대와 박쥐 — 동쪽 거대 짐승 뼈 벌판.
  wolves: { x: 20, y: 40 } as Cell, bats: { x: 24, y: 17 } as Cell, mixed: { x: 58, y: 44 } as Cell,
  save: { x: 33, y: 41 } as Cell,
};
