import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import {
  checkedDocument,
  spatialId as id,
} from "../../src/project/spatial/domain";
import type { Project } from "../../src/project/types";
import type {
  SpaceDesign,
  SpatialObjectSlot,
} from "../../src/project/spatial/types";
import {
  registerCompactHouseInterior,
  COMPACT_INTERIOR_SPACE,
} from "./compactHouseInterior.mts";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";
const atlas = "easyrpg_chipset_interior";
export function registerReviewedInteriorCatalog(input: Project): Project {
  const project = structuredClone(registerCompactHouseInterior(input));
  const doc = project.spatialAuthoring!;
  const put = (space: SpaceDesign) => {
    const old = doc.library.spaces[space.id];
    doc.library.spaces[space.id] = {
      ...space,
      revision: old
        ? isDeepStrictEqual({ ...old, revision: 1 }, { ...space, revision: 1 })
          ? old.revision
          : old.revision + 1
        : 1,
    };
  };
  const cabinet = project.tilesets[atlas]!.structureKits!.find(
    (k) => k.id === "compact-interior:cabinet",
  )!;
  cabinet.ai = {
    description: "벽에 겹치는 수납장",
    placementRules: "",
    ...cabinet.ai,
    snap: "wall-north",
    interiorRole: "cabinet",
  };
  for (const obj of Object.values(doc.library.objects))
    if (obj.graphic.tilesetId === atlas && obj.graphic.kitId === "cabinet")
      doc.library.objects[obj.id] = {
        ...obj,
        revision: obj.revision + 1,
        graphic: { tilesetId: atlas, kitId: cabinet.id },
      };
  // Compact replacement graphics retain the imported object identities and event chips.
  for (const obj of Object.values(doc.library.objects))
    if (
      obj.graphic.tilesetId === atlas &&
      [
        "tea_table",
        "dining_table",
        "consultation_table",
        "reading_table",
        "table_white",
        "table_wood",
        "work_table",
        "altar_table",
        "teacher_desk",
      ].includes(obj.graphic.kitId)
    ) {
      const target = [
        "work_table",
        "teacher_desk",
        "altar_table",
        "table_white",
        "table_wood",
      ].includes(obj.graphic.kitId)
        ? "compact-interior:single-dining"
        : "table_chairs";
      doc.library.objects[obj.id] = {
        ...obj,
        revision: obj.revision + 1,
        graphic: { tilesetId: atlas, kitId: target },
      };
    }
  const originals = Object.values(doc.library.spaces).filter(
    (s) => s.environment === "interior" && s.id.startsWith("legacy:"),
  );
  for (const old of originals) {
    const key = JSON.parse(old.id.slice(7));
    const canonical =
      key[2] === "place-context"
        ? originals.find((s) => {
            const k = JSON.parse(s.id.slice(7));
            return k[1] === key[1] && k[2] === "place" && s.name === old.name;
          })
        : old;
    const base = canonical ?? old;
    const sizes: Record<string, [number, number]> = {
      "inn:attic": [7, 5],
      "inn:suite": [7, 5],
      "inn:dining": [9, 5],
      "inn:merchant": [7, 4],
      "manor:suite": [7, 5],
      "hunter:lodge": [7, 4],
      "library:reading": [9, 5],
      "church:chapel": [9, 6],
      "alchemist:laboratory": [7, 4],
      "farmhouse:hearthroom": [7, 4],
    };
    const baseKey = JSON.parse(base.id.slice(7));
    const [width, height] = sizes[`${baseKey[1]}:${baseKey[3]}`] ?? [
      Math.min(base.width, 9),
      Math.min(base.height, 5),
    ];
    const ports = old.ports.length
      ? [...old.ports]
      : [
          {
            id: id("entry"),
            name: "출입구",
            x: Math.floor(width / 2),
            y: height - 1,
          },
        ];
    const objectSlots = old.objectSlots.map((slot) => {
      const obj = doc.library.objects[slot.objectDesignId]!;
      if (!(slot.chipOverrides ?? obj.chips).includes("transfer")) return slot;
      // An imported transfer chip has no destination. Expose a connectable space port
      // instead of inventing a self-transfer or making standalone space builds fail.
      ports.push({ id: id(`stair:${slot.id}`), name: "위층 연결", x: 1, y: 0 });
      return {
        ...slot,
        objectDesignId: houseObjectForGraphic(project, atlas, "stairs_small")!
          .id,
        chipOverrides: (slot.chipOverrides ?? obj.chips).filter(
          (c) => c !== "transfer",
        ),
        placement: { mode: "fixed" as const, x: 1, y: 0 },
      };
    });
    put({
      ...old,
      width,
      height,
      shape: "rect",
      ports,
      objectSlots,
      wall: "cream",
      tags: [
        ...old.tags.filter((t) => t !== "실내 검수 20260913"),
        "실내 검수 20260913",
      ],
    });
  }
  const seed = doc.library.spaces[COMPACT_INTERIOR_SPACE]!;
  const slot = (
    key: string,
    kit: string,
    x: number,
    y: number,
    overlap?: 1 | 2,
  ): SpatialObjectSlot => ({
    id: id(key),
    objectDesignId: kit.startsWith("compact-interior:")
      ? id(kit)
      : houseObjectForGraphic(project, atlas, kit)!.id,
    quantity: 1,
    required: true,
    placement: {
      mode: "fixed",
      x,
      y,
      ...(overlap ? { wallOverlap: overlap } : {}),
    },
  });
  // Keep entry/down/up identities so saved place connections refresh without relinking.
  for (const key of ["ground", "middle", "top"]) {
    const old = doc.library.spaces[`house-catalog:room:${key}`]!;
    assert.ok(old);
    const down = key !== "ground",
      up = key !== "top";
    put({
      ...seed,
      id: old.id,
      revision: old.revision,
      name:
        key === "ground"
          ? "작은 주택 1층 · 거실·침실·계단"
          : key === "middle"
            ? "작은 주택 중간층 · 침실·계단참"
            : "작은 주택 최상층 · 침실·서가",
      ports: [
        {
          id: id(down ? "down" : "entry"),
          name: down ? "아래층 계단" : "현관",
          x: 3,
          y: 5,
        },
        ...(up ? [{ id: id("up"), name: "위층 계단", x: 3, y: 0 }] : []),
      ],
      objectSlots: [
        ...seed.objectSlots.filter((s) => s.id !== "plant"),
        ...(down ? [slot("stairs-down", "stairs_down", 3, 5)] : []),
        ...(up
          ? [slot("stairs-up", "stairs_small", 3, 0)]
          : [slot("plant", "plant", 3, 0)]),
      ],
    });
  }
  const variants: [
    string,
    string,
    number,
    number,
    number,
    string,
    [string, string, number, number, (1 | 2)?][],
  ][] = [
    [
      "family",
      "작은 가족집 · 식사방과 두 침대",
      9,
      6,
      5,
      "wood",
      [
        ["stove", "compact-interior:wall-stove", 0, 0],
        ["dishes", "compact-interior:cabinet", 1, 0, 1],
        ["jars", "jars", 2, 0],
        ["meal", "table_chairs", 0, 4],
        ["bed-a", "bed_v", 5, 0],
        ["bed-b", "bed_v", 8, 0],
        ["wardrobe", "compact-interior:cabinet", 6, 0, 1],
      ],
    ],
    [
      "scholar",
      "작은 서재집 · 서가와 침실",
      9,
      6,
      5,
      "wood",
      [
        ["books", "bookshelf", 0, 0],
        ["desk", "table_chairs", 0, 4],
        ["bed", "bed_v", 8, 0],
        ["wardrobe", "compact-interior:cabinet", 5, 0, 1],
        ["bedside", "compact-interior:bedside-table", 7, 0],
      ],
    ],
    [
      "herbalist",
      "약초 상점 · 매장과 안방",
      10,
      7,
      6,
      "wood",
      [
        ["counter", "counter", 0, 1],
        ["stock", "jars", 4, 0],
        ["stock2", "box", 4, 1],
        ["display", "compact-interior:single-dining", 1, 4],
        ["bed", "bed_v", 9, 0],
        ["wardrobe", "compact-interior:cabinet", 6, 0, 1],
        ["jar", "jars", 7, 0],
      ],
    ],
    [
      "craftsman",
      "장인의 집 · 작업실과 침실",
      10,
      7,
      6,
      "wood",
      [
        ["stove", "compact-interior:wall-stove", 0, 0],
        ["bench", "compact-interior:single-dining", 2, 1],
        ["supplies", "crate", 0, 4],
        ["bed", "bed_v", 9, 0],
        ["wardrobe", "compact-interior:cabinet", 6, 0, 1],
        ["table", "compact-interior:bedside-table", 8, 0],
      ],
    ],
    [
      "inn-suite",
      "작은 여관 객실 · 응접실과 침실",
      9,
      6,
      5,
      "plank",
      [
        ["tea", "table_chairs", 0, 3],
        ["cabinet", "compact-interior:cabinet", 0, 0, 1],
        ["plant", "plant", 3, 0],
        ["bed-a", "bed_v", 5, 0],
        ["bed-b", "bed_v", 8, 0],
        ["bedside", "compact-interior:bedside-table", 6, 0],
      ],
    ],
    [
      "clinic",
      "작은 진료소 · 상담실과 병실",
      10,
      7,
      6,
      "stone",
      [
        ["desk", "compact-interior:single-dining", 0, 2],
        ["cabinet", "compact-interior:cabinet", 0, 0, 1],
        ["seat", "stool", 1, 4],
        ["bed-a", "care_bed", 6, 0],
        ["bed-b", "bed_v", 9, 0],
        ["water", "bucket", 9, 4],
      ],
    ],
    [
      "farmhouse",
      "작은 농가 · 취사방과 저장방",
      9,
      6,
      5,
      "plank",
      [
        ["stove", "compact-interior:wall-stove", 0, 0],
        ["jars", "jars", 1, 0],
        ["meal", "table_chairs", 0, 4],
        ["crate", "crate", 5, 0],
        ["grain", "grain", 6, 0],
        ["barrel", "barrel", 8, 0],
        ["bed", "bed_v", 8, 3],
      ],
    ],
    [
      "watchhouse",
      "작은 경비 숙소 · 장비실과 침실",
      9,
      6,
      5,
      "stone",
      [
        ["armor", "armor", 0, 0, 1],
        ["box", "box", 2, 0],
        ["desk", "table_chairs", 0, 4],
        ["bed-a", "bed_v", 5, 0],
        ["bed-b", "bed_v", 8, 0],
        ["wardrobe", "compact-interior:cabinet", 6, 0, 1],
      ],
    ],
  ];
  for (const [key, name, width, height, split, floor, items] of variants)
    put({
      ...seed,
      id: id(`reviewed-interior:${key}`),
      name,
      width,
      height,
      floor,
      tags: ["실내", "소형 기준", "방 구획", "실내 검수 20260913"],
      ports: [{ id: id("entry"), name: "현관", x: split - 2, y: height - 1 }],
      interiorLayout: {
        rooms: [
          {
            id: id("front"),
            name: name.split("·")[1]!.split("과")[0]!.trim(),
            x: 0,
            y: 0,
            width: split,
            height,
          },
          {
            id: id("back"),
            name: "안쪽 방",
            x: split,
            y: 0,
            width: width - split,
            height,
          },
        ],
        doorways: [{ x: split - 1, y: 3 }],
      },
      objectSlots: items.map((args) => slot(...args)),
    });
  project.spatialAuthoring = checkedDocument(doc, project);
  return project;
}
