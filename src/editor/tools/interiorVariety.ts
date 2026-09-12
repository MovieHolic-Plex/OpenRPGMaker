// editor/tools/interiorVariety.ts
// 연결 실내의 도면 다양성 — houseVariety(외장)의 실내판 관찰 고리.
//
// 왜 필요한가(2026-09-12): interiorPlan·seed 경로를 열었어도 모델이 "지금 실내가 몇 종인지"
// 볼 수단이 없으면 한 도면에 수렴한다. 시공 직후 roomHarnessPlan 을 되읽어 도면 서명과
// 물건 세트를 집계하고, 단조로우면 경고로 되먹인다(외장 detectHouses + houseVarietyReport 와 같은 고리).
//
// 서명 규약:
//  · 도면 = roomHarnessPlan 의 방 배치(위치·크기·장소)·정문·내부 문. 가구 위치(시드가 흔드는
//    러그·침대 자리)는 도면이 아니라 물건 세트 축에서 잡는다.
//  · 물건 세트 = concept 오버레이 물건 objectId 의 정렬된 합집합 — "전부 같은 12종" 문제를 본다.
//  · 도면 기록이 없는 맵은 하부 레이어 자체가 서명이다(초기 측정이 lower 해시 비교였던 계보).

import type { InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import type { GameMap } from "@/project/types";

export type InteriorDesignSource = "planned" | "template" | "seed";

/** 집 한 채의 연결 실내 — 층 맵들을 1층→위층 순으로. */
export type InteriorVarietyInput = {
  readonly source: InteriorDesignSource;
  readonly maps: readonly GameMap[];
};

export type InteriorVarietyReport = {
  /** 실내를 지은 집 수. */
  readonly interiors: number;
  readonly floors: number;
  /** 서로 다른 도면(층 스택 단위) 종 수. */
  readonly distinctBlueprints: number;
  readonly blueprintCounts: readonly (readonly [string, number])[];
  /** 2채 이상 같은 도면 — 값이 있으면 "같은 실내 찍어내기"가 실제로 생긴 것. */
  readonly repeatedBlueprints: readonly (readonly [string, number])[];
  /** 서로 다른 물건 세트 종 수(오버레이 없는 실내는 세트에서 제외). */
  readonly distinctObjectSets: number;
  /** 실내가 둘 이상인데 물건 세트가 전부 동일. */
  readonly identicalObjects: boolean;
  readonly sources: Readonly<Record<InteriorDesignSource, number>>;
  readonly verdict: "diverse" | "mixed" | "monotonous";
  readonly advice: readonly string[];
};

function planOf(map: GameMap): InteriorRoomPlan | undefined {
  const plan = map.roomHarnessPlan?.plan;
  return plan && typeof plan === "object" ? (plan as InteriorRoomPlan) : undefined;
}

/** 층 하나의 도면 서명 — 방 배치·정문·내부 문. 가구 위치 변동은 잡지 않는다. */
function floorKey(map: GameMap): string {
  const plan = planOf(map);
  if (!plan?.rooms?.length) return `raw:${map.width}x${map.height}:${map.lowerTiles.join(",")}`;
  const rooms = plan.rooms
    .map((room) => {
      const placeId = plan.concept?.rooms[room.id]?.placeId ?? room.theme ?? room.id;
      return `${room.x},${room.y},${room.w},${room.h},${placeId}${room.shape ? `:${room.shape}` : ""}`;
    })
    .sort()
    .join(";");
  const innerDoors = (plan.innerDoors ?? []).map((door) => `${door.x},${door.y}`).sort().join(";");
  return `plan:${plan.width}x${plan.height}|door ${plan.door.x},${plan.door.y}|${rooms}|${innerDoors}`;
}

function objectSetKey(maps: readonly GameMap[]): string {
  const ids = new Set<string>();
  for (const map of maps) {
    const plan = planOf(map);
    for (const room of Object.values(plan?.concept?.rooms ?? {})) {
      for (const thing of room.things) ids.add(thing.objectId);
    }
  }
  return [...ids].sort().join(",");
}

/** 도면 표기 — 1층 장소 라벨 + 치수. 같은 서명이면 라벨도 같다. */
function blueprintLabel(maps: readonly GameMap[]): string {
  const plan = maps[0] ? planOf(maps[0]) : undefined;
  const places = plan?.rooms?.length
    ? [...new Set(plan.rooms.map((room) => plan.concept?.rooms[room.id]?.placeLabel ?? room.theme ?? room.id))].join("+")
    : "raw";
  const floors = maps.length > 1 ? `${maps.length}층·` : "";
  return `${floors}${places} ${plan?.width ?? maps[0]?.width ?? 0}x${plan?.height ?? maps[0]?.height ?? 0}`;
}

export function interiorVarietyReport(interiors: readonly InteriorVarietyInput[]): InteriorVarietyReport {
  const signatures = interiors.map((entry) => entry.maps.map(floorKey).join("‖"));
  const labels = interiors.map((entry) => blueprintLabel(entry.maps));
  const objects = interiors.map((entry) => objectSetKey(entry.maps));
  const bySignature = new Map<string, { label: string; count: number }>();
  signatures.forEach((signature, index) => {
    const slot = bySignature.get(signature) ?? { label: labels[index]!, count: 0 };
    slot.count += 1;
    bySignature.set(signature, slot);
  });
  const blueprintCounts = [...bySignature.values()]
    .map(({ label, count }) => [label, count] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const repeatedBlueprints = blueprintCounts.filter(([, count]) => count > 1);
  const distinctBlueprints = bySignature.size;
  const knownObjectSets = objects.filter((key) => key !== "");
  const distinctObjectSets = new Set(knownObjectSets).size;
  const identicalObjects =
    interiors.length > 1 && knownObjectSets.length === interiors.length && distinctObjectSets === 1;
  const sources: Record<InteriorDesignSource, number> = { planned: 0, template: 0, seed: 0 };
  for (const entry of interiors) sources[entry.source] += 1;
  const floors = interiors.reduce((sum, entry) => sum + entry.maps.length, 0);

  const verdict: InteriorVarietyReport["verdict"] = interiors.length <= 1
    ? "diverse"
    : distinctBlueprints <= 1
      ? "monotonous"
      : distinctBlueprints >= Math.ceil(interiors.length * 0.6)
        ? "diverse"
        : "mixed";

  const advice: string[] = [];
  if (repeatedBlueprints.length > 0) {
    advice.push(
      `실내 도면 반복: ${repeatedBlueprints.map(([label, count]) => `${label}×${count}`).join(", ")}. `
      + "interiorPlan 을 집마다 다르게 설계하라(장소 수·크기·구역·층·물건).",
    );
  }
  if (identicalObjects) {
    advice.push(
      "실내마다 물건 구성이 전부 같다 — get_concept_facility 의 vocabularyGroups 에서 같은 역할의 다른 물건을 골라라.",
    );
  }
  if (sources.seed > 0) {
    advice.push(
      `절차 도면(씨앗)으로 지은 실내 ${sources.seed}채 — 같은 규모·용도는 같은 도면이 된다. 요청에 맞는 실내는 interiorPlan 이 정본이다.`,
    );
  }
  if (advice.length === 0) advice.push("실내 도면이 충분히 갈렸다. 추가 조정 없이 진행해도 된다.");

  return {
    interiors: interiors.length,
    floors,
    distinctBlueprints,
    blueprintCounts,
    repeatedBlueprints,
    distinctObjectSets,
    identicalObjects,
    sources,
    verdict,
    advice,
  };
}

/** 한 줄 요약 — 툴 summary/경고에 그대로 싣는다. */
export function interiorVarietySummary(report: InteriorVarietyReport): string {
  return `실내 ${report.interiors}채 · 도면 ${report.distinctBlueprints}종 · 물건 세트 ${report.distinctObjectSets}종 → ${report.verdict}`;
}
