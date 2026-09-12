/** Exercise saved objects through the editor AI's real preview/apply contract. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { deserialize } from "../src/project/io";
import { createBlankMap } from "../src/project/defaults/defaultMaps";
import { runTool } from "../src/editor/tools/toolRunner";
const out=process.argv[2] ?? "output/evidence/house-30/all";
const source=deserialize(fs.readFileSync(`${out}/reloaded-project.json`,"utf8"));
const manifest=JSON.parse(fs.readFileSync(`${out}/manifest.json`,"utf8"));
const results=[];
for(const item of manifest.placements) {
  const context={project:structuredClone(source)};
  const object=source.spatialAuthoring!.library.objects[item.objectId]!;
  const tileset=source.tilesets[object.graphic.tilesetId]!;
  const kit=tileset.structureKits!.find(kit=>kit.id===object.graphic.kitId)!;
  assert.equal(kit.kind,"section");if(kit.kind!=="section")throw new Error("section required");
  const map=createBlankMap("House placement contract",kit.width+6,kit.height+6,tileset.id,tileset.tileSize);
  map.id="house30-placement-contract";context.project.maps[map.id]=map;
  context.project.mapTree.children.push({mapId:map.id,children:[]});
  const target={mapId:map.id,rect:{x:2,y:2,width:kit.width,height:kit.height+1},
    entry:{x:2+object.anchors[0]!.x,y:2+object.anchors[0]!.y}};
  const preview=runTool(context,"preview_spatial_build",{kind:"object",id:object.id,occurrenceId:`house30-check:${item.number}`,seed:20260912,target});
  assert.ok(preview.ok,JSON.stringify({number:item.number,preview}));
  assert.ok(preview.data&&typeof preview.data==="object"&&"previewId" in preview.data);
  const applied=runTool(context,"apply_spatial_build",{previewId:preview.data.previewId});
  assert.ok(applied.ok,JSON.stringify({number:item.number,applied}));
  const built=context.project.maps[map.id]!;
  kit.rows.forEach((row,y)=>row.tiles.forEach((tile,x)=>{
    const at=(y+2)*built.width+x+2;
    if(tile>=0)assert.equal(built.lowerTiles[at],tile);
    if((row.upperTiles?.[x]??-1)>=0)assert.equal(built.upperTiles[at],row.upperTiles![x]);
  }));
  results.push({number:item.number,objectId:object.id,preview:true,apply:true,rasterMatches:true,ports:object.anchors.length});
}
fs.writeFileSync(`${out}/tool-build-proof.json`,JSON.stringify({projectId:manifest.projectId,provider:null,mode:"registered-tools",houses:results.length,results},null,2));
console.log(JSON.stringify({houses:results.length,allPreviewApply:true,rasterMatches:true}));
