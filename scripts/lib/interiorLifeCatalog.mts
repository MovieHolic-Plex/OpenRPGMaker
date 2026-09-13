import { isDeepStrictEqual } from "node:util";
import type { Project, SectionStructureKitDef } from "../../src/project/types";
import {
  spatialId as id,
  checkedDocument,
} from "../../src/project/spatial/domain";
import { HOUSE_SHELL_FACE_TILES } from "../../src/project/defaults/interiorHouseWallTiles";
import { spaceLayout } from "../../src/editor/spatial/spaceLayout";
import {
  isPassableLanding,
  tilePassability,
} from "../../src/project/collision";
import { computeReachableCells } from "../../src/project/lint/reachability";
import {
  INTERIOR_OBJECT_CATALOG,
  interiorTableCells,
} from "../../src/project/defaults/interiorObjectCatalog";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";
const atlas = "easyrpg_chipset_interior";
type Cell = { dx: number; dy: number; layer: "lower" | "upper"; tile: number };
type Zone = {
  key: string;
  name: string;
  w: number;
  h: number;
  overlap?: 1 | 2;
  cells: Cell[];
  rules: string;
};
const cells = (
  rows: number[][],
  layer: "lower" | "upper",
  x = 0,
  y = 0,
): Cell[] =>
  rows.flatMap((r, dy) =>
    r.flatMap((tile, dx) =>
      tile < 0 ? [] : [{ dx: dx + x, dy: dy + y, layer, tile }],
    ),
  );
const floor = (w: number, h: number, tile: number, y = 0) =>
  cells(
    Array.from({ length: h }, () => Array(w).fill(tile)),
    "lower",
    0,
    y,
  );
const at = (kit: string, x: number, y: number): Cell[] =>
  INTERIOR_OBJECT_CATALOG.find((k) => k.id === kit)!.cells.map((c) => ({
    ...c,
    dx: c.dx + x,
    dy: c.dy + y,
  }));
const rug = (w: number, h: number, red = false) =>
  cells(
    Array.from({ length: h }, (_, y) =>
      Array.from(
        { length: w },
        (_, x) =>
          (red ? 375 : 108) +
          (y === 0 ? 0 : y === h - 1 ? 60 : 30) +
          (x === 0 ? 0 : x === w - 1 ? 2 : 1),
      ),
    ),
    "lower",
  );
/** Reusable authored activity assemblies: backing, furniture and props share one spatial identity. */
export function interiorLifeZones(): Zone[] {
  const dining = (
    key: string,
    name: string,
    props: number[],
    red = false,
  ): Zone => ({
    key,
    name,
    w: 7,
    h: 5,
    rules:
      "식탁과 의자는 러그 위에 함께 놓는다. 책·잔은 상판에만 놓고 사방 접근 통로를 남긴다.",
    cells: [
      ...rug(7, 5, red),
      ...interiorTableCells(3, 2).map((c) => ({
        ...c,
        dx: c.dx + 2,
        dy: c.dy + 1,
      })),
      ...cells([[297, -1, -1, -1, 298]], "upper", 1, 2),
      ...props.map((tile, i) => ({
        dx: 2 + i,
        dy: 1,
        layer: "upper" as const,
        tile,
      })),
    ],
  });
  return [
    dining("meal", "식사 구역 · 러그·식탁·마주 보는 의자", [237, 204]),
    dining("reading", "독서 구역 · 펼친 책·촛대·러그", [145, 204], true),
    {
      key: "tea",
      name: "차 마시는 자리 · 작은 러그와 두 좌석",
      w: 5,
      h: 3,
      rules: "작은 방의 중앙이나 창가에 놓고 양쪽 의자 앞을 비운다.",
      cells: [...rug(5, 3), ...at("table_chairs", 1, 1)],
    },
    {
      key: "hearth",
      name: "난롯가 · 석조 벽난로·책장·장작과 돌바닥",
      w: 7,
      h: 5,
      overlap: 2,
      rules:
        "윗 두 행을 북벽에 겹친다. 불 앞 돌바닥은 비우고 장작과 물통은 옆에 둔다.",
      cells: [
        ...floor(7, 3, 42, 2),
        ...cells(
          [
            [402, 403, 404],
            [432, 433, 434],
          ],
          "upper",
          2,
          0,
        ),
        ...cells([[462, 124, 464]], "lower", 2, 2),
        ...cells(
          [
            [18, 20],
            [48, 50],
            [78, 80],
          ],
          "upper",
          0,
          0,
        ),
        ...cells([[21], [51]], "upper", 6, 1),
        ...at("bucket", 5, 3),
      ],
    },
    {
      key: "kitchen",
      name: "취사 구역 · 화덕·그릇장·물통과 돌바닥",
      w: 4,
      h: 3,
      overlap: 1,
      rules:
        "첫 행은 북벽에 겹친다. 화덕과 수납장 앞 한 줄은 작업 통로로 둔다.",
      cells: [
        ...floor(4, 2, 42, 1),
        ...cells(
          [
            [21, -1, 148],
            [51, -1, 178],
          ],
          "upper",
        ),
        ...at("bucket", 3, 1),
      ],
    },
    {
      key: "bath",
      name: "세면 구역 · 개수대·거울·항아리와 돌바닥",
      w: 4,
      h: 3,
      rules:
        "개수대 옆 거울과 물 항아리를 함께 놓는다. 아래 행은 개수대 접근 통로다.",
      cells: [
        ...floor(4, 3, 42),
        ...cells(
          [
            [22, 23],
            [52, 53],
          ],
          "upper",
          2,
          0,
        ),
        ...at("mirror", 0, 0),
        ...at("kettle", 1, 1),
      ],
    },
    {
      key: "sleep",
      name: "침상 구역 · 침대·수납장·침대 옆 깔개",
      w: 4,
      h: 3,
      overlap: 1,
      rules: "수납장 윗칸은 북벽과 겹친다. 침대 발치와 옆 한 칸을 비운다.",
      cells: [
        ...floor(4, 2, 102, 1),
        ...cells([[148], [178]], "upper", 3, 0),
        ...at("bed_v", 0, 1),
        ...cells([[249]], "lower", 1, 2),
      ],
    },
    {
      key: "books",
      name: "서가 구역 · 책장·독서 걸상과 나무 바닥",
      w: 4,
      h: 4,
      overlap: 1,
      rules:
        "책장 윗행을 북벽에 겹친다. 서가 앞 두 행은 책을 꺼내고 앉는 자리다.",
      cells: [
        ...floor(4, 3, 102, 1),
        ...cells(
          [
            [18, 19, 20],
            [48, 49, 50],
            [78, 79, 80],
          ],
          "upper",
        ),
        ...at("stool", 1, 3),
      ],
    },
    {
      key: "curtain",
      name: "붉은 커튼 · 윗장식과 연결된 자락",
      w: 2,
      h: 3,
      overlap: 2,
      rules:
        "북벽 두 행에 겹치고 자락 한 행만 방 안으로 내려온다. 출입구·계단을 가리지 않는다.",
      cells: cells(
        [
          [142, 143],
          [172, 173],
          [202, 203],
        ],
        "upper",
      ),
    },
  ];
}
export function registerInteriorLifeCatalog(input: Project): Project {
  const p = structuredClone(input),
    lib = p.spatialAuthoring!.library;
  const zones = interiorLifeZones();
  const reading = zones.find((z) => z.key === "reading")!;
  for (const [key, name, prop] of [
    ["herbal", "약초 작업 구역 · 약병과 꽃병", 350],
    ["craft", "공방 작업 구역 · 도구와 촛대", 353],
    ["watch", "기록 구역 · 펼친 책과 잔", 145],
  ] as const)
    zones.push({
      ...reading,
      key,
      name,
      cells: reading.cells.map((c) =>
        c.layer === "upper" && c.tile === 145 ? { ...c, tile: prop } : c,
      ),
      rules:
        "작업 소품은 탁자 상판에 함께 놓고 의자 양쪽과 아래 통로를 비운다.",
    });
  zones.push({
    key: "twins",
    name: "가족 침상 · 두 침대와 공용 수납장",
    w: 4,
    h: 5,
    overlap: 1,
    rules: "두 침대 사이와 출입구에서 이어지는 위쪽 접근 통로를 비운다.",
    cells: [
      ...floor(4, 4, 102, 1),
      ...cells([[148], [178]], "upper", 2, 0),
      ...at("bed_v", 0, 3),
      ...at("bed_v", 3, 3),
    ],
  });
  const sleep = zones.find((z) => z.key === "sleep")!;
  zones.push({
    ...sleep,
    key: "sleep-right",
    name: "침상 구역 · 오른쪽 침대와 수납장",
    cells: sleep.cells.map((c) => ({ ...c, dx: sleep.w - 1 - c.dx })),
  });
  for (const z of zones) {
    const kitId = `interior-life:${z.key}`;
    const by = new Map(
      z.cells.map((c) => [`${c.dx},${c.dy},${c.layer}`, c.tile]),
    );
    const kit: SectionStructureKitDef = {
      id: kitId,
      kind: "section",
      name: z.name,
      width: z.w,
      height: z.h,
      rows: Array.from({ length: z.h }, (_, y) => ({
        tiles: Array.from(
          { length: z.w },
          (_, x) => by.get(`${x},${y},lower`) ?? -1,
        ),
        upperTiles: Array.from(
          { length: z.w },
          (_, x) => by.get(`${x},${y},upper`) ?? -1,
        ),
      })),
      learnedFrom: "db-authored",
      ai: {
        description: z.name,
        placementRules: z.rules,
        snap: z.overlap ? "wall-north" : "floor",
        interiorRole: "decoration",
      },
    };
    const kits = p.tilesets[atlas].structureKits ?? [];
    p.tilesets[atlas].structureKits = [
      ...kits.filter((k) => k.id !== kitId),
      kit,
    ];
    const old = lib.objects[kitId];
    const next = {
      id: id(kitId),
      name: z.name,
      revision: old?.revision ?? 1,
      tags: ["생활 구역", "가구와 바닥의 조합", z.rules],
      provenance: { origin: "ai" as const, sourceId: "interior-life-20260914" },
      graphic: { tilesetId: atlas, kitId },
      anchors: [],
      chips: [],
    };
    lib.objects[kitId] =
      old && !isDeepStrictEqual(old, next)
        ? { ...next, revision: old.revision + 1 }
        : next;
  }
  // Explicit order is stable across JSONB key ordering and preserves other authored spaces.
  const targetIds = [
    "house-catalog:room:top",
    "reviewed-interior:clinic",
    "reviewed-interior:family",
    "house-catalog:room:ground",
    "house-catalog:room:middle",
    "house-catalog:room:single",
    "reviewed-interior:scholar",
    "reviewed-interior:craftsman",
    "reviewed-interior:farmhouse",
    "reviewed-interior:herbalist",
    "reviewed-interior:inn-suite",
    "reviewed-interior:watchhouse",
  ];
  const targets = targetIds.map((key) => lib.spaces[key]);
  if (targets.some((s) => !s || s.environment !== "interior"))
    throw new Error("Reviewed home catalog is incomplete");
  for (const [n, s] of targets.entries()) {
    const upper = /middle|top/.test(s.id),
      reverse = n % 3 === 1;
    // A large living room and offset small private wing; notches follow the use of the wing.
    const mw = n % 2 ? 10 : 9,
      height = n % 4 === 2 ? 12 : 11 + (n % 2);
    const livingX = reverse ? 5 : 0,
      wingX = reverse ? 0 : mw + 1;
    const rooms: any[] = [
      {
        id: id("living"),
        name: upper ? "독서와 휴식" : "난롯가와 식사",
        x: livingX,
        y: 2,
        width: mw,
        height: height - 2,
        shape: "rect" as const,
        floor: "wood",
      },
      {
        id: id("sleep"),
        name: "작은 침실",
        x: wingX,
        y: 0,
        width: 4,
        height: 5,
        floor: "plank",
      },
      {
        id: id("work"),
        name: n % 3 === 2 ? "서재" : "씻는 방",
        x: wingX,
        y: height - 4,
        width: 4,
        height: 4,
        floor: n % 3 === 2 ? "plank" : "gravel",
      },
    ];
    if (n % 4 === 0) rooms.pop();
    if (n % 4 === 2) {
      rooms[0] = { ...rooms[0], y: 6, height: 6 };
      rooms.push({
        id: id("kitchen"),
        name: "난로와 수납방",
        x: livingX,
        y: 0,
        width: mw,
        height: 3,
        floor: "wood",
      });
    }
    const doorways = [
      { x: reverse ? 4 : mw, y: n % 4 === 2 ? 1 : 3 },
      ...(rooms.some((r) => r.id === "work")
        ? [{ x: reverse ? 4 : mw, y: height - 2 }]
        : []),
      ...(n % 4 === 2 ? [{ x: livingX + 5, y: 3 }] : []),
    ];
    const draft: any = {
      ...s,
      width: mw + 5,
      height,
      shape: "rect",
      floor: "wood",
      wall: n % 4 === 3 ? "stone-brick" : "cream",
      interiorLayout: { rooms, doorways },
      objectSlots: [],
      ports: s.ports.map((port, i) => ({
        ...port,
        x: i === 0 ? livingX + Math.floor(mw / 2) : livingX + mw - 2,
        y: i === 0 ? height - 1 : height - 2,
      })),
      tags: [
        ...new Set([
          ...s.tags.filter(
            (t) =>
              !/^생활 구역 구성|^난롯가·식탁·침상·세면·커튼$|^통로는 비우고 가구는 용도별로 모은다$|방 · 단차 외곽$/.test(
                t,
              ),
          ),
          "생활 구역 구성 20260914",
          "난롯가·식탁·침상·세면·커튼",
          "통로는 비우고 가구는 용도별로 모은다",
        ]),
      ],
    };
    const layout = spaceLayout(p, draft, { mapId: "life-layout", seed: 7 });
    let map = layout.map;
    const occupied = new Set<string>();
    const ports = draft.ports.map((q: any) => ({ x: q.x + 2, y: q.y + 4 }));
    const safe = (candidate: any) => {
      const reached = computeReachableCells(
        p,
        candidate,
        ports[0].x,
        ports[0].y,
      );
      if (ports.some((q: any) => !reached.has(`${q.x},${q.y}`))) return false;
      for (let y = 4; y < 16; y++)
        for (let x = 2; x < 17; x++)
          if (
            isPassableLanding(p, candidate, x, y) &&
            !reached.has(`${x},${y}`)
          )
            return false;
      return true;
    };
    if (!safe(map)) {
      const reached = computeReachableCells(p, map, ports[0].x, ports[0].y);
      throw Error(
        JSON.stringify({
          id: s.id,
          rooms,
          doorways,
          ports,
          isolated: map.lowerTiles.flatMap((_, i) =>
            isPassableLanding(
              p,
              map,
              i % map.width,
              Math.floor(i / map.width),
            ) && !reached.has(`${i % map.width},${Math.floor(i / map.width)}`)
              ? [`${i % map.width},${Math.floor(i / map.width)}`]
              : [],
          ),
        }),
      );
    }
    const add = (
      key: string,
      room: (typeof rooms)[number],
      preferredX: number,
      preferredY: number,
      required = true,
    ) => {
      const z = zones.find((z) => z.key === key)!;
      const candidates = [];
      for (
        let y = room.y;
        y <= room.y + room.height - (z.h - (z.overlap ?? 0));
        y++
      )
        for (let x = room.x; x <= room.x + room.width - z.w; x++)
          candidates.push({
            x,
            y,
            score: Math.abs(x - preferredX) + Math.abs(y - preferredY),
          });
      candidates.sort((a, b) => a.score - b.score);
      for (const pos of candidates) {
        const list = z.cells.map((c) => ({
          ...c,
          x: c.dx + pos.x + 2,
          y: c.dy + pos.y + 4 - (z.overlap ?? 0),
        }));
        if (
          list.some(
            (c) =>
              occupied.has(`${c.x},${c.y}`) ||
              ports.some((q: any) => q.x === c.x && q.y === c.y) ||
              (ports.some(
                (q: any) => Math.abs(q.x - c.x) + Math.abs(q.y - c.y) <= 1,
              ) &&
                (c.layer === "upper" ||
                  !tilePassability(p.tilesets[atlas], c.tile, -1).down)),
          )
        )
          continue;
        if (
          list.some((c) =>
            c.y < pos.y + 4
              ? c.layer !== "upper" ||
                !HOUSE_SHELL_FACE_TILES.includes(
                  map.lowerTiles[c.y * map.width + c.x],
                )
              : !layout.floor[c.y * map.width + c.x],
          )
        )
          continue;
        const next = structuredClone(map);
        for (const c of list)
          (c.layer === "lower" ? next.lowerTiles : next.upperTiles)[
            c.y * map.width + c.x
          ] = c.tile;
        if (!safe(next)) continue;
        map = next;
        for (const c of list) occupied.add(`${c.x},${c.y}`);
        draft.objectSlots.push({
          id: id(`life-${key}-${draft.objectSlots.length}`),
          objectDesignId: id(`interior-life:${key}`),
          quantity: 1,
          required: true,
          placement: {
            mode: "fixed",
            ...pos,
            ...(z.overlap ? { wallOverlap: z.overlap } : {}),
          },
        });
        delete draft.objectSlots.at(-1).placement.score;
        return;
      }
      if (required)
        throw Error(
          `No connected ${key} placement in ${s.id} ${JSON.stringify({ n, room, rooms, doorways, candidates })}`,
        );
    };
    add(
      s.id.endsWith(":family") ? "twins" : reverse ? "sleep" : "sleep-right",
      rooms[1],
      wingX,
      0,
    );
    const work = rooms.find((r) => r.id === "work");
    if (work) add(n % 3 === 2 ? "books" : "bath", work, wingX, work.y);
    const kitchen = rooms.find((r) => r.id === "kitchen") ?? rooms[0];
    add(
      upper || /scholar/.test(s.id)
        ? "books"
        : /farmhouse/.test(s.id)
          ? "kitchen"
          : "hearth",
      kitchen,
      livingX,
      kitchen.y,
    );
    const focus = /herbalist|clinic/.test(s.id)
      ? "herbal"
      : /craftsman/.test(s.id)
        ? "craft"
        : /watchhouse/.test(s.id)
          ? "watch"
          : upper || /scholar/.test(s.id)
            ? "reading"
            : "meal";
    add(focus, rooms[0], livingX + 1, 6);
    add("curtain", kitchen, livingX + mw - 2, kitchen.y);
    const clock = houseObjectForGraphic(p, atlas, "clock");
    if (clock)
      draft.objectSlots.push({
        id: id("life-wall-clock"),
        objectDesignId: clock.id,
        quantity: 1,
        required: true,
        placement: { mode: "auto" },
      });
    // Existing stair slot IDs and ports remain the transfer contract.
    for (const slot of s.objectSlots.filter((slot) =>
      slot.id.startsWith("stairs-"),
    )) {
      const port = draft.ports.find(
        (q: any) => q.id === slot.id.replace("stairs-", ""),
      )!;
      draft.objectSlots.push({
        ...slot,
        placement: { mode: "fixed", x: port.x, y: port.y },
      });
    }
    if (!isDeepStrictEqual({ ...draft, revision: 1 }, { ...s, revision: 1 }))
      draft.revision = s.revision + 1;
    lib.spaces[s.id] = draft;
  }
  checkedDocument(p.spatialAuthoring, p);
  return p;
}
