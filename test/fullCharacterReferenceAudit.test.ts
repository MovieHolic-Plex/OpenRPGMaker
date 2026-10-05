import { afterEach, describe, expect, it } from "vitest";
import corrections from "@/assets/characterReferenceCorrections.json";
import previousNames from "@/assets/previousFaceReferenceNames.json";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { listEventResourceOptions } from "@/ai/eventResourceCatalog";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { QUERY_TOOLS } from "@/editor/tools/queryTools";
import { createBlankProject, ensureBundledResourceProfiles } from "@/project/defaults";
import { defaultSharedCharacterGraphics, parseSharedCharacterGraphicsDocument } from "@/project/sharedCharacterGraphicsSchema";
import { acceptSharedCharacterGraphics, reconcileSharedFaceWithCharset, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";

const project = () => createBlankProject();
const tool = (name: string) => QUERY_TOOLS.find(tool => tool.name === name)!;
const search = async (p: ReturnType<typeof project>, query: string) =>
  (await tool("list_resources").run(p, {kind:"faceset",query,limit:50})).data as {matches:{id:string;label:string;description:string}[]};
afterEach(() => acceptSharedCharacterGraphics(defaultSharedCharacterGraphics()));

describe("Complete character reference census regressions", () => {
  it("migrates untouched old rows, preserves authored edits, and is idempotent", () => {
    const original = defaultSharedCharacterGraphics();
    original.mappings = corrections.mappings.map(change => structuredClone(change.before)) as typeof original.mappings;
    original.faces = corrections.faces.map(change => structuredClone(change.before));
    const migrated = parseSharedCharacterGraphicsDocument(original);
    expect(migrated.mappings).toEqual(corrections.mappings.map(change => change.after));
    expect(migrated.faces).toEqual(corrections.faces.map(change => change.after));
    expect(parseSharedCharacterGraphicsDocument(migrated)).toEqual(migrated);
    original.mappings[0]!.note = "저자가 직접 검토한 짝";
    expect(parseSharedCharacterGraphicsDocument(original).mappings[0]).toEqual(original.mappings[0]);
  });

  it("removes 19 blank cells from picker, prompt and search despite stored profiles", async () => {
    expect(GENERATED_FACESET_FACE_IDS.size).toBe(19);
    const p = project();
    for (const id of GENERATED_FACESET_FACE_IDS) p.resourceProfiles.push({kind:"faceset",assetId:id,name:"빈 칸"});
    const picker = new Set(listDatabaseResourceOptions("faceset",p).map(row=>row.id));
    const prompt = new Set(listEventResourceOptions("faceset",p).map(row=>row.id));
    for (const id of GENERATED_FACESET_FACE_IDS) {
      expect(picker.has(id)).toBe(false);
      expect(prompt.has(id)).toBe(false);
      expect((await search(p,id)).matches).toEqual([]);
    }
  });

  it("does not mistake an uploaded replacement for the public blank/face pixels", async () => {
    const p = project(), id = "generated-faceset-missing-scarloxy-15";
    p.assets.uploaded[id] = {id,kind:"faceset",name:"우리 캐릭터",dataUrl:"data:image/png;base64,AA=="};
    p.resourceProfiles.push({kind:"faceset",assetId:id,name:"우리 캐릭터"});
    ensureBundledResourceProfiles(p);
    expect(p.resourceProfiles.some(row=>row.assetId===id)).toBe(true);
    expect(listDatabaseResourceOptions("faceset",p).find(row=>row.id===id)?.name).toBe("우리 캐릭터");
    expect((await search(p,id)).matches[0]).toMatchObject({id,label:"우리 캐릭터"});
    expect((await search(p,id)).matches[0]?.description).toContain("사용자 업로드");
  });

  it("updates seeded old face names in existing projects and retains custom names", async () => {
    const p = project(), id = "shared-actor2-blue-hat-woman-expressions-00";
    const profile = p.resourceProfiles.find(row=>row.assetId===id)!;
    profile.name = (previousNames as Record<string,string>)[id]!;
    expect((await search(p,id)).matches[0]?.label).toContain("붉은 모자 푸른 머리");
    ensureBundledResourceProfiles(p);
    expect(profile.name).toContain("붉은 모자 푸른 머리");
    profile.name = "우리 마법사";
    ensureBundledResourceProfiles(p);
    expect((await search(p,id)).matches[0]?.label).toBe("우리 마법사");
  });

  it("uses the accepted host mapping for search, NPC candidates, auto-face and reconciliation", async () => {
    const catalog = defaultSharedCharacterGraphics(), p = project();
    const row = catalog.mappings.find(row=>row.textureKey==="tex_easyrpg_charset_people3" && row.characterIndex===0)!;
    row.faceResourceId = "easyrpg-faceset-actor1-00";
    catalog.faces.find(face=>face.resourceId===row.faceResourceId)!.label="호스트 검토 얼굴";
    acceptSharedCharacterGraphics(catalog);
    expect(sharedFaceForCharset(row.textureKey,0)?.resourceId).toBe(row.faceResourceId);
    const npc = (await tool("list_npc_graphics").run(p,{query:"왕"})).data as {matches:{textureKey:string;face:{resourceId:string}}[]};
    expect(npc.matches.find(match=>match.textureKey===row.textureKey)?.face.resourceId).toBe(row.faceResourceId);
    expect((await search(p,"호스트 검토 얼굴")).matches[0]?.description).toContain("people3#0 왕");
    expect(reconcileSharedFaceWithCharset("easyrpg-faceset-people1-00",row.textureKey,0).faceResourceId).toBe(row.faceResourceId);
  });

  it.each([["monster3",1],["monster3",4],["monster3",6],["actor4",5]])("withholds incompatible %s #%s automatic face", (sheet,index) => {
    expect(sharedFaceForCharset(`tex_easyrpg_charset_${sheet}`,Number(index))).toBeNull();
  });

  it("offers source-linked original face portraits and searches non-base expressions", async () => {
    const p = project();
    const npc = (await tool("list_npc_graphics").run(p,{query:"갈색 머리 청년"})).data as {matches:{textureKey:string;characterIndex:number;portraitOptions:{mode:string;note?:string}[]}[]};
    const options = npc.matches.find(row=>row.textureKey==="tex_easyrpg_charset_actor1" && row.characterIndex===0)?.portraitOptions;
    expect(options?.map(row=>row.mode)).toEqual(["face","bust","full"]);
    expect(options?.[2]?.note).toContain("별도 그림");
    const id="shared-people1-boy-expressions-full-wink";
    expect((await search(p,id)).matches).toHaveLength(1);
    expect((await search(p,id)).matches[0]?.id).toBe(id);
    expect((await search(p,"generated-face-actor1-full")).matches[0]?.description).toContain("실제 그림은 흉상");
  });

  it.each([
    ["king-slime-01","금관 쓴 파란 슬라임","green"], ["golem-clay","항아리 골렘","moss"],
    ["skeleton-bone","뼈 뱀","sword"], ["puppet-string","도자기 얼굴 인형","dagger"],
    ["wyvern-cliff","보라 와이번","황록색"], ["armor-living","청회색","purple"],
  ])("corrects replaced monster pixels: %s", (suffix,name,obsoleteTag) => {
    const row=listMonsterResources(project()).find(row=>row.resourceId===`generated-enemy-${suffix}`)!;
    expect(row.name).toContain(name); expect(row.tags).not.toContain(obsoleteTag);
  });

  it("resolves exact monster IDs without semantic tags", async () => {
    const p = project();
    for (const id of ["generated-enemy-golem-clay","scarloxy-monster-atrox"]) {
      const result = (await tool("list_resources").run(p,{kind:"monster",query:id,limit:50})).data as {matches:{id:string;label:string}[]};
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]?.id).toBe(id);
      expect(result.matches[0]?.label).toBe(listMonsterResources(p).find(row=>row.resourceId===id)?.name);
    }
  });
});
