/** Negative control: the previous saved houses must fail the depth review. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { deserialize } from "../src/project/io";
import { DEFAULT_TILESET_ID } from "../src/project/defaults/constants";
import { HOUSE_HEIGHT_STUDIES } from "./lib/houseHeightStudies.mts";
import { bakeHouseStudy } from "./lib/houseStudyDesigns.mts";
import { reviewHouseRoofDepth } from "./lib/houseHeightDepthReview.mts";
const out="output/evidence/house-heights";
const oldPath=`${out}/review-before/project.json`;
if(!fs.existsSync(oldPath))fs.copyFileSync(`${out}/reloaded-project.json`,oldPath);
const before=deserialize(fs.readFileSync(oldPath,"utf8"));
const results=HOUSE_HEIGHT_STUDIES.filter(item=>item.floors>2).map(item=>{
  const current=bakeHouseStudy(item.study);
  const old=before.tilesets[DEFAULT_TILESET_ID]!.structureKits!.find(kit=>kit.id===current.id)!;
  const oldReview=reviewHouseRoofDepth(old),newReview=reviewHouseRoofDepth(current);
  assert.ok(oldReview.issues.length>0,"Negative control did not catch the rejected geometry");
  assert.equal(newReview.visibleFloors,item.floors);
  assert.deepEqual(newReview.issues,[]);
  // Deliberately delete one retained corner. The review must reject the mutation.
  const damaged=structuredClone(current),facade=newReview.facades[1]!;
  damaged.rows[facade.y-1]!.upperTiles![facade.x]=-1;
  assert.ok(reviewHouseRoofDepth(damaged).issues.some(issue=>issue.includes("왼쪽 처마")));
  return {before:oldReview,after:newReview,missingCornerNegativeControl:true};
});
fs.writeFileSync(`${out}/depth-review.json`,JSON.stringify({review:"adversarial geometry review",results},null,2));
console.log(JSON.stringify({reviewed:results.length,oldRejected:results.length,newPassed:results.length,negativeControls:results.length}));
