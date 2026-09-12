import { describe,expect,it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { authorHouse30, inspectHouse30 } from "../scripts/lib/house30Authoring.mts";
import { buildHouse30BatchA } from "../scripts/lib/house30BatchA.mts";
import { buildHouse30BatchB } from "../scripts/lib/house30BatchB.mts";
import { buildHouse30BatchC } from "../scripts/lib/house30BatchC.mts";

describe("thirty authored house exteriors",()=>{
  it("has thirty distinct baked geometries with connected roofs and reachable door approaches",()=>{
    const entries=[...buildHouse30BatchA(),...buildHouse30BatchB(),...buildHouse30BatchC()];
    expect(entries.map(e=>e.number)).toEqual(Array.from({length:30},(_,i)=>i+1));
    const report=inspectHouse30(entries);
    expect(new Set(report.map(r=>r.geometrySHA256)).size).toBe(30);
    expect(report.every(r=>r.connectedRoof&&r.exteriorDoorApproaches>0)).toBe(true);
  });
  it("rejects a forbidden balcony material in the actual raster",()=>{
    const entry=buildHouse30BatchA()[0]!;
    entry.kit.rows[2]!.tiles[2]=196;
    expect(()=>inspectHouse30([entry])).toThrow(/forbidden tile 196/);
  });
  it("rejects a roof split into detached halves",()=>{
    const entry=buildHouse30BatchA()[0]!;
    const x=Math.floor(entry.kit.width/2);
    for(const row of entry.kit.rows){row.tiles[x]=-1;if(row.upperTiles)row.upperTiles[x]=-1;}
    expect(()=>inspectHouse30([entry])).toThrow(/disconnected roofs/);
  });
  it("rejects a courtyard door whose approach has been painted over",()=>{
    const entry=buildHouse30BatchA().find(e=>e.number===8)!;
    const door=entry.doors[0]!;
    entry.kit.rows[door.y+1]!.tiles[door.x]=45;
    expect(()=>inspectHouse30([entry])).toThrow(/door approach cannot reach outside/);
  });
  it("does not count a wall recolor as another shape",()=>{
    const first=buildHouse30BatchA()[0]!,copy=structuredClone(first);
    copy.number=2;copy.kit.id="house-30-02-color-only";
    const colors=new Map([[15,12],[16,13],[17,14],[45,42],[46,43],[47,44],[75,72],[76,73],[77,74],[85,87]]);
    for(const row of copy.kit.rows){row.tiles=row.tiles.map(t=>colors.get(t)??t);if(row.upperTiles)row.upperTiles=row.upperTiles.map(t=>colors.get(t)??t);}
    expect(()=>inspectHouse30([first,copy])).toThrow(/only material\/color differs/);
  });
});

it("advances an existing object revision when only its kit pixels change, and keeps a repeat registration stable", () => {
  const project = createBlankProject(); project.spatialAuthoring = emptySpatialDocument();
  const entries = buildHouse30BatchA();
  const first = authorHouse30(project, entries).project;
  const old = first.spatialAuthoring!.library.objects["house30:object:1"]!;
  const changed = structuredClone(entries);
  changed[0]!.kit.rows[5]!.upperTiles![1] = 87;
  const second = authorHouse30(first, changed).project;
  expect(second.spatialAuthoring!.library.objects[old.id]!.revision).toBe(old.revision + 1);
  expect(authorHouse30(second, changed).project).toEqual(second);
}, 90_000);
