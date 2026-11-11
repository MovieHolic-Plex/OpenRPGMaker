// 조수 v2 게임 내용 검사 — 실행이 바꾼 이벤트·데이터를 요청 낱말과 맞대어 «흉내»와 «빠진 쪽»을 짚는다.
//
// 왜(2026-10-24 새 12 사례): 비 → 화면 색만, 독 → 소리·번쩍임만, 엔딩 → 내레이션+타이틀, 우물 동전 → 물건이 없어도 고르기 창,
// 암호 → 「이미 통과」 페이지 없음·선언 안 한 깃발. 모델이 「됐다」고 말해도 이 검사가 남은 문제를 끝맺음 관문에 올린다.
// 순수 함수(before·after·요청 글) — 워커·테스트가 같이 부른다.
import type { Command, GameMap, Project } from "@/project/types";
import { dryBoats, dryBridges, placementProblems, type PlacementProblem } from "../place/placementRules";
import { offPurposeProps } from "../place/roomPurpose";
import { tagged, type Finding } from "./finding";
import { gameCheck } from "./gameCheckReads";
import { battleChecks, effectChecks, endingStateChecks, worldChecks } from "./gameAskedChecks";
import { flagChecks, selfSwitchChecks } from "./gameFlagChecks";
import { lookChecks, shownChecks } from "./gameShownChecks";
import { sceneChecks, storyChecks } from "./gameStoryChecks";

/** 실행이 바꾼 내용에서 요청과 어긋나는 것 — 끝맺음 관문이 고칠 거리로 올린다. 빈 배열이면 문제 없음. */
export function gameContentProblems(before: Project, after: Project, task: string): Finding[] {
  const check = gameCheck(before, after, task);
  // 차례가 곧 관문 항목의 차례다 — 바꾸지 않는다.
  return [
    ...effectChecks(check),
    ...shownChecks(check),
    ...worldChecks(check),
    ...endingStateChecks(check),
    ...flagChecks(check),
    ...storyChecks(check),
    ...selfSwitchChecks(check),
    ...sceneChecks(check),
    ...battleChecks(check),
    ...lookChecks(check),
    ...placementContentProblems(before, after),
  ];
}

/**
 * 놓기 검사(2026-10-25 판정 J5·J6·J40·J42·J31·J64, 사용자 규칙 «차도 한가운데 사람 금지»):
 * 이번에 바뀐 맵의 사람·조사 이벤트 자리, 방 쓰임에 안 맞는 가구. 바뀐 이벤트(자리·페이지)만, 새로 지은 맵·타일이 바뀐 맵은 전부 본다.
 */
export function placementContentProblems(before: Project, after: Project): Finding[] {
  const out: Finding[] = [];
  const tilesKey = (m: GameMap | undefined): string => (m ? `${m.width}x${m.height}:${(m.lowerTiles as readonly number[] | undefined)?.join(",") ?? ""}|${(m.upperTiles as readonly number[] | undefined)?.join(",") ?? ""}|${(m.lowerOverlayTiles as readonly number[] | undefined)?.join(",") ?? ""}` : "");
  for (const map of Object.values(after.maps)) {
    const prev = before.maps[map.id];
    const rebuilt = !prev || tilesKey(prev) !== tilesKey(map);
    const oldEvents = new Map((prev?.events ?? []).map((e) => [e.id, JSON.stringify(e)]));
    const ids = new Set((map.events ?? []).filter((e) => rebuilt || oldEvents.get(e.id) !== JSON.stringify(e)).map((e) => e.id));
    if (ids.size) {
      const rows = placementProblems(after, map, ids);
      const by = (kind: PlacementProblem["kind"]) => rows.filter((r) => r.kind === kind).slice(0, 4).map((r) => `「${r.name}」(${r.eventId}) ${r.detail}`);
      const where = map.name ?? map.id;
      const lane = by("npc-lane"), exit = by("npc-exit"), counter = by("npc-counter"), object = by("event-object");
      if (lane.length) out.push(tagged("game", "사람 자리", `${where}: ${lane.join(" / ")} — 사람은 차도·선로 한가운데 서서 말하지 않는다. move_event 로 보도·가게 문 앞·벤치 옆·광장으로 옮기고, 배회하는 사람이면 movement 를 fixed 로 바꾸거나 보도 안쪽에 둔다.`));
      if (exit.length) out.push(tagged("game", "길막", `${where}: ${exit.join(" / ")} — 출구로 가는 한 칸 길이 막히면 플레이어가 맵을 못 나간다. move_event 로 길목에서 두세 칸 떨어진 넓은 바닥으로 옮기고, 배회는 fixed 로 바꾼다.`));
      if (counter.length) out.push(tagged("game", "카운터", `${where}: ${counter.join(" / ")} — 주인은 카운터 «뒤»(카운터 바로 위 칸, 아래를 보게) 선다. move_event 로 카운터 북쪽 칸에 옮기면 플레이어는 카운터 너머로 말을 건다.`));
      const prop = by("transfer-prop"), bare = by("door-bare");
      if (prop.length) out.push(tagged("game", "출입구", `${where}: ${prop.join(" / ")} — move_event 로 출입구를 옆 빈 바닥(계단·문 앞 칸)으로 옮기거나 그 물건을 tile_erase 로 걷는다.`, { variant: "misplaced" }));
      if (bare.length) {
        const r0 = rows.find((r) => r.kind === "door-bare")!;
        const adit = map.tilesetId === "beodeul_city" ? ` 버들항이면 stamp_object{objectId:'kit:beodeul_city/bd-pick-mining-valley-adit',mapId:'${map.id}',x:${r0.at.x - 2},y:${r0.at.y - 4}} — 갱구 문이 출입구 바로 위 칸에 온다.` : "";
        out.push(tagged("game", "출입구", `${where}: ${bare.join(" / ")} — 출입구 바로 위에 굴 입구·문 그림을 찍는다(list_spatial_designs{kind:'object',query:'갱구·동굴 입구·문'}).${adit} 그림이 없으면 보고에 「굴 입구 그림 없음」으로 적는다.`, { variant: "no-art" }));
      }
      if (object.length) out.push(tagged("game", "물건 자리", `${where}: ${object.join(" / ")} — 조사 이벤트는 이름이 말하는 물건 칸(키 큰 가구는 맨 아래 앞면 칸)에 둔다. move_event 로 그 칸으로 옮긴다.`));
    }
    if (rebuilt) {
      const dry = dryBridges(after, map);
      if (dry.length) out.push(tagged("game", "다리", `${map.name ?? map.id}: 물에 닿지 않는 다리 ${dry.length}곳 ${dry.slice(0, 4).map((c) => `(${c.x},${c.y})`).join(" ")} — 마른 바닥 위 다리로 보인다. tile_erase 로 그 다리 칸을 바닥으로 되돌리거나, 물을 건너는 자리로 옮긴다.`, { variant: "dry-bridge" }));
      const boats = dryBoats(after, map);
      if (boats.length) out.push(tagged("game", "다리", `${map.name ?? map.id}: 물이 아닌 바닥 위의 배 ${boats.length}척 ${boats.slice(0, 4).map((c) => `(${c.x},${c.y})`).join(" ")} — 뭍에 오른 배·마른 바닥 위 나무다리로 보인다. tile_erase 로 걷고 물 칸 위(배 전체가 물)로 다시 찍거나 edit_place 로 다시 짓는다.`, { variant: "dry-boat" }));
      const off = offPurposeProps(after, map);
      if (off.length) out.push(tagged("game", "방 쓰임", `${map.name ?? map.id}: ${off.slice(0, 3).map((r) => `${r.room}(${r.purpose}) 에 ${r.props.slice(0, 4).map((p) => `${p.label}(${p.at.x},${p.at.y})`).join("·")}`).join(" / ")} — 그 방의 쓰임에 안 맞는 다른 방 가구다(거실 한 벌). tile_erase 로 걷어 내고 그 쓰임의 가구(예배당: 장의자·촛대, 가게: 진열대·카운터, 교실: 책상·의자, 병원: 침상·진료 책상)를 stamp_object 로 그 가구 자리에 찍거나(쓰임에 안 맞는 가구는 찍을 때 저절로 걷힌다, 다른 가구와 겹치면 onOverlap:'replace'|'nearest') edit_place 로 그 방을 다시 꾸민다.`));
    }
  }
  return out;
}

export type { Command };
