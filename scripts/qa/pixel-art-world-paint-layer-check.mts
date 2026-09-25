// Regression demonstrated by the live home run: lower repairs used to erase furniture heads.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {runTool} from '../../src/editor/tools/index';
const project=JSON.parse(fs.readFileSync('output/paw-direct-v2/home-repair/result-project.json','utf8'));
const mapId='direct-home',ctx={project},before=[...project.maps[mapId].upperTiles];
const wall=runTool(ctx,'paint_tiles',{mapId,layer:'lower',mode:'cells',tile:15,cells:[{x:12,y:1}]});
assert(wall.ok);assert.deepEqual(ctx.project.maps[mapId].upperTiles,before,'wall repair erased an upper furniture fragment');
const floor=runTool(ctx,'paint_tiles',{mapId,layer:'lower',mode:'cells',tile:0,cells:[{x:2,y:8}]});
assert(floor.ok);assert.deepEqual(ctx.project.maps[mapId].upperTiles,before,'floor repair erased furniture');
const erase=runTool(ctx,'paint_tiles',{mapId,layer:'upper',mode:'cells',tile:-1,cells:[{x:12,y:1}]});
assert(erase.ok);assert.equal(ctx.project.maps[mapId].upperTiles[1*14+12],-1,'explicit upper erase failed');
const proof={pass:true,lowerWallPreservesFurniture:true,lowerFloorPreservesFurniture:true,explicitUpperEraseWorks:true,canonicalProjectNotModified:true};
fs.writeFileSync('output/paw-direct-v2/layer-check.json',JSON.stringify(proof,null,2));console.log(proof);
