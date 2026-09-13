import { isDeepStrictEqual } from "node:util";
import type { Project } from "../../src/project/types";
import type { SpaceDesign } from "../../src/project/spatial/types";
import {
  spatialId as id,
  checkedDocument,
} from "../../src/project/spatial/domain";
import { interiorRoomRects } from "../../src/project/interiorRoomFootprint";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";
const atlas = "easyrpg_chipset_interior";
const shapes = ["l", "l-right", "alcove", "bay", "notch", "cross"] as const;
const hash = (s: string) =>
  [...s].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Authored floor catalog: preserve identities/connections and give each program a footprint and material. */
export function registerDiverseInteriorCatalog(input: Project): Project {
  const p = structuredClone(input),
    lib = p.spatialAuthoring!.library;
  const stove = p.tilesets[atlas].structureKits?.find(
    (k) => k.id === "compact-interior:wall-stove",
  );
  if (stove?.kind === "section")
    stove.rows[0] = { tiles: [-1], upperTiles: [21] };
  const floorFor = (group: string, n: number) =>
    ({
      clinic: ["jade", "gravel"],
      bank: ["jade", "stone"],
      church: ["gravel", "jade"],
      alchemist: ["dark-stone", "stone"],
      smithy: ["gravel", "dark-stone"],
      warehouse: ["plank", "dark-stone"],
      farmhouse: ["mat", "wood"],
      manor: ["jade", "plank"],
      library: ["plank", "wood"],
      tavern: ["wood", "stone"],
    })[group]?.[n % 2] ?? ["wood", "plank", "mat", "gravel"][n % 4];
  const wallFor = (g: string) =>
    ["manor", "bank", "guild"].includes(g)
      ? "gold-brick"
      : [
            "clinic",
            "church",
            "smithy",
            "warehouse",
            "townhall",
            "alchemist",
          ].includes(g)
        ? "stone-brick"
        : "cream";
  // Restore the furniture programs whose authored identities survived the previous compacting pass.
  for (const obj of Object.values(lib.objects)) {
    if (obj.graphic.tilesetId !== atlas || !obj.id.startsWith("legacy:"))
      continue;
    const tuple = JSON.parse(obj.id.slice(7));
    const key = tuple.at(-1);
    const candidates = [
      "tea_table",
      "reading_table",
      "dining_table",
      "consultation_table",
      "work_table",
      "altar_table",
      "teacher_desk",
    ];
    const kit = candidates.find((k) => String(key).includes(k));
    if (!kit) continue;
    const next = { ...obj, graphic: { ...obj.graphic, kitId: kit } };
    if (!isDeepStrictEqual(obj, next))
      lib.objects[obj.id] = { ...next, revision: obj.revision + 1 };
  }
  for (const s of Object.values(lib.spaces).filter(
    (s) => s.environment === "interior",
  )) {
    const key = s.id.startsWith("legacy:") ? JSON.parse(s.id.slice(7)) : null;
    const group = key?.[1] ?? s.id.split(":").at(-1)!;
    const h = hash(group + ":" + s.name.replace(/ ·.*$/, ""));
    const variant = h % 6;
    let width = 8 + (h % 5),
      height = 6 + (Math.floor(h / 7) % 4);
    if (group === "house" && /거실/.test(s.name)) {
      width = 10;
      height = 8;
    }
    if (group === "bank") {
      width = Math.max(width, 11);
      height = Math.max(height, 8);
    }
    if (group === "alchemist") {
      width = Math.max(width, 10);
      height = Math.max(height, 9);
    }
    if (group === "clinic") {
      width = Math.max(width, 12);
      height = Math.max(height, 9);
    }
    if (group === "library" && /열람|독서/.test(s.name)) {
      width = 13;
      height = 9;
    }
    let floor = floorFor(group, h),
      wall = wallFor(group);
    let shape: SpaceDesign["shape"] = shapes[variant];
    let interiorLayout: any = undefined;
    let ports = s.ports.map((port, i) => ({
      ...port,
      x: i === 0 ? Math.floor(width / 2) : i === 1 ? 1 : width - 2,
      y: i === 0 ? height - 1 : Math.min(height - 2, 3 + i),
    }));
    let objectSlots = s.objectSlots.map((slot) => ({
      ...slot,
      ...(slot.id === "water" && houseObjectForGraphic(p, atlas, "kettle")
        ? { objectDesignId: houseObjectForGraphic(p, atlas, "kettle")!.id }
        : {}),
      placement: { mode: "auto" as const },
    }));
    if (!key) {
      // Distinct complete dwellings: offset upper rooms and a connected lower living room.
      const order = [
        "house-catalog:room:single",
        "house-catalog:room:ground",
        "house-catalog:room:middle",
        "house-catalog:room:top",
        "reviewed-interior:family",
        "reviewed-interior:scholar",
        "reviewed-interior:herbalist",
        "reviewed-interior:craftsman",
        "reviewed-interior:inn-suite",
        "reviewed-interior:clinic",
        "reviewed-interior:farmhouse",
        "reviewed-interior:watchhouse",
      ].indexOf(s.id);
      const n = Math.max(0, order);
      width = 11 + (n % 3);
      height = 11 + (n % 2);
      shape = "rect";
      const R = (
        key: string,
        name: string,
        x: number,
        y: number,
        w: number,
        h: number,
        material: string,
        form = "rect",
      ) => ({
        id: id(key),
        name,
        x,
        y,
        width: w,
        height: h,
        floor: material,
        shape: form,
      });
      let rooms: any[], doorways: any[];
      switch (n % 6) {
        case 0:
          width = 12;
          height = 8;
          rooms = [
            R("living", "꺾인 생활방", 0, 0, 7, 8, "wood", "alcove"),
            R("sleep", "옆으로 붙은 침실", 8, 3, 4, 5, "mat"),
          ];
          doorways = [{ x: 7, y: 5 }];
          break;
        case 1:
          width = 12;
          height = 12;
          rooms = [
            R("sleep", "침실", 0, 0, 5, 4, "plank"),
            R("work", "서재와 수납", 6, 0, 6, 5, "jade"),
            R("living", "아래채 생활방", 1, 8, 10, 4, "wood"),
          ];
          doorways = [
            { x: 2, y: 4 },
            { x: 8, y: 5 },
          ];
          break;
        case 2:
          width = 13;
          height = 12;
          rooms = [
            R("sleep", "침실", 0, 0, 6, 4, "mat"),
            R("work", "작업방", 7, 0, 6, 4, "gravel"),
            R("living", "거실", 0, 7, 6, 5, "wood"),
            R("pantry", "저장방", 7, 7, 6, 5, "dark-stone"),
          ];
          doorways = [
            { x: 3, y: 4 },
            { x: 9, y: 4 },
            { x: 6, y: 9 },
          ];
          break;
        case 3:
          width = 15;
          height = 8;
          rooms = [
            R("living", "벽이 돌출된 작업실", 0, 0, 10, 8, "gravel", "notch"),
            R("sleep", "돌출된 작은 방", 11, 3, 4, 5, "plank"),
          ];
          doorways = [{ x: 10, y: 5 }];
          break;
        case 4:
          width = 15;
          height = 8;
          rooms = [
            R("sleep", "왼쪽 작은 방", 0, 2, 4, 6, "mat"),
            R("living", "중앙 생활방", 5, 0, 5, 8, "wood"),
            R("work", "오른쪽 작업방", 11, 3, 4, 5, "jade"),
          ];
          doorways = [
            { x: 4, y: 5 },
            { x: 10, y: 5 },
          ];
          break;
        default:
          width = 12;
          height = 13;
          rooms = [
            R("sleep", "안쪽 침실", 0, 0, 5, 4, "plank"),
            R("work", "취사와 수납방", 6, 0, 6, 4, "dark-stone"),
            R("living", "남쪽 돌출 거실", 2, 7, 8, 6, "wood", "bay"),
          ];
          doorways = [
            { x: 3, y: 4 },
            { x: 8, y: 4 },
          ];
          break;
      }
      interiorLayout = { rooms, doorways };
      const living = rooms.find((r) => r.id === "living")!;
      ports = s.ports.map((port, i) => ({
        ...port,
        x:
          i === 0
            ? living.x + Math.floor(living.width / 2)
            : i === 1
              ? living.x + 1
              : living.x + living.width - 2,
        y: i === 0 ? height - 1 : living.y + Math.min(2, living.height - 2),
      }));
      floor = floorFor(group, n);
      wall = ["cream", "stone-brick", "gold-brick"][n % 3];
    }
    const recipes: Record<string, string[]> = {
      inn: ["rug_mat", "stool", "picture"],
      bank: ["clock", "box", "cabinet"],
      guild: ["armor", "picture", "stool"],
      clinic: ["care_bed", "cabinet", "plant"],
      hunter: ["armor", "grain", "barrel"],
      manor: ["piano", "mirror", "rug_red"],
      tavern: ["barrel", "stool", "tavern_sign"],
      house: ["rug_mat", "cabinet", "plant"],
      smithy: ["armor", "bucket", "box"],
      bakery: ["grain", "bucket", "fruit_shelf"],
      school: ["bookshelf_small", "stool", "picture"],
      townhall: ["picture", "clock", "cabinet"],
      alchemist: ["crystal_ball", "cabinet", "shelf_jars"],
      farmhouse: ["grain", "grain", "bucket"],
      church: ["religious", "rug_red", "bust"],
      library: ["bookshelf_small", "clock", "stool"],
      shop: ["display", "box", "barrel"],
      warehouse: ["grain", "box", "barrel"],
    };
    const additions = recipes[group] ?? [];
    if (key)
      for (const [j, kit] of additions.entries()) {
        if (objectSlots.length >= 6) break;
        const obj = houseObjectForGraphic(p, atlas, kit);
        if (!obj) continue;
        const slotId = id(`diverse-detail-${j}`);
        if (objectSlots.some((s) => s.id === slotId)) continue;
        objectSlots.push({
          id: slotId,
          objectDesignId: obj.id,
          quantity: 1,
          required: false,
          placement: { mode: "auto" },
        });
      }
    if (interiorLayout) {
      const parts = interiorLayout.rooms;
      const sleep = parts.find((r: any) => r.id === "sleep") ?? parts[0];
      const work =
        parts.find((r: any) => r.id === "work") ??
        parts.find((r: any) => r.id === "living");
      const living = parts.find((r: any) => r.id === "living");
      let beds = 0,
        cabinets = 0;
      const north = (r: any) =>
        interiorRoomRects({
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          shape: r.shape,
        })[0];
      objectSlots = objectSlots.map((slot) => {
        const kit = lib.objects[slot.objectDesignId].graphic.kitId;
        if (kit === "bed_v") {
          const r = north(sleep);
          return {
            ...slot,
            placement: {
              mode: "fixed",
              x: r.x + (beds++ ? r.w - 2 : 0),
              y: r.y,
            },
          };
        }
        if (kit === "compact-interior:cabinet") {
          const r = north(cabinets++ ? sleep : work);
          return {
            ...slot,
            placement: {
              mode: "fixed",
              x: r.x + r.w - 1,
              y: r.y,
              wallOverlap: 1,
            },
          };
        }
        if (kit === "compact-interior:wall-stove") {
          const r = north(work ?? living);
          return {
            ...slot,
            placement: { mode: "fixed", x: r.x, y: r.y, wallOverlap: 1 },
          };
        }
        return slot;
      });
    }
    if (interiorLayout) {
      const add = (key: string, kit: string, roomKey: string) => {
        if (objectSlots.some((slot) => slot.id === id(key))) return;
        const obj = houseObjectForGraphic(p, atlas, kit),
          r = interiorLayout.rooms.find((r: any) => r.id === roomKey);
        if (!obj || !r) return;
        objectSlots.push({
          id: id(key),
          objectDesignId: obj.id,
          quantity: 1,
          required: true,
          placement: { mode: "auto" },
        });
      };
      if (
        s.id === "house-catalog:room:middle" ||
        s.id === "house-catalog:room:top"
      )
        objectSlots = objectSlots.filter(
          (slot) => !["stove", "water", "meal"].includes(slot.id),
        );
      add("diverse-work-seat", "stool", "work");
      add("diverse-storage", "box", "pantry");
      add("diverse-storage-grain", "grain", "pantry");
      const work = interiorLayout.rooms.find((r: any) => r.id === "work");
      if (work)
        objectSlots = objectSlots.map((slot) =>
          slot.id === "books"
            ? { ...slot, placement: { mode: "fixed", x: work.x, y: work.y } }
            : slot,
        );
      // Give the small ancillary rooms an actual use instead of leaving an empty fourth room.
      objectSlots = objectSlots.map((slot) => {
        const pantry = interiorLayout.rooms.find((r: any) => r.id === "pantry");
        if (pantry && slot.id === "diverse-storage")
          return {
            ...slot,
            placement: { mode: "fixed", x: pantry.x + 1, y: pantry.y },
          };
        if (pantry && slot.id === "diverse-storage-grain")
          return {
            ...slot,
            placement: {
              mode: "fixed",
              x: pantry.x + pantry.width - 1,
              y: pantry.y + 1,
            },
          };
        if (work && slot.id === "diverse-work-seat")
          return {
            ...slot,
            placement: {
              mode: "fixed",
              x: work.x + work.width - 2,
              y: work.y + work.height - 1,
            },
          };
        return slot;
      });
    }
    // All stairs keep their existing port identities and get explicit floor-local anchors.
    objectSlots = objectSlots.map((slot) => {
      const obj = lib.objects[slot.objectDesignId];
      if (!/stairs|stair/.test(obj?.graphic.kitId ?? "")) return slot;
      const port =
        ports.find((p) => p.id === slot.id.replace("stairs-", "")) ??
        ports.find((p) => p.id.includes("stair")) ??
        ports.find((p) => p.id === "up") ??
        ports[0];
      return {
        ...slot,
        placement: { mode: "fixed" as const, x: port.x, y: port.y },
      };
    });
    const draft: any = {
      ...s,
      width,
      height,
      shape,
      floor,
      wall,
      ports,
      objectSlots,
      tags: [
        ...s.tags.filter(
          (t) =>
            !/소형 기준|바닥 |통합 거실|벽으로 분리|침실 출입|실내 검수|실내 전면 재설계| 외곽|방 · 단차/.test(
              t,
            ),
        ),
        "실내 전면 재설계 20260913",
        key ? `${shape} 외곽` : `${interiorLayout.rooms.length}방 · 단차 외곽`,
      ],
    };
    delete draft.interiorLayout;
    if (interiorLayout) draft.interiorLayout = interiorLayout;
    if (!isDeepStrictEqual({ ...draft, revision: 1 }, { ...s, revision: 1 }))
      draft.revision = s.revision + 1;
    lib.spaces[s.id] = draft;
  }
  checkedDocument(p.spatialAuthoring, p);
  return p;
}
