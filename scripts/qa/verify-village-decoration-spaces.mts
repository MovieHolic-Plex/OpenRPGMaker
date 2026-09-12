/** Verify saved attachment spaces through the ordinary editor AI space preview tool. Read-only. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { deserialize } from "../../src/project/io";
import { runTool } from "../../src/editor/tools/toolRunner";
const source=process.argv[2]??"output/evidence/village-decoration/reloaded-project.json";
const out=process.argv[3]??"output/evidence/village-decoration";
const project=deserialize(fs.readFileSync(source,"utf8")),context={project};
const rules=project.villagePresets!.find(p=>p.id==="small-village-dense")!.design!.objectVillage!.decorations!;
const results=rules.map((rule,index)=>{
 const result=runTool(context,"preview_spatial_build",{kind:"space",id:rule.spaceId,occurrenceId:`decoration-space-review-${index}`,seed:7});
 assert.ok(result.ok,`${rule.spaceId}: ${result.summary}`);
 assert.equal(context.project,project,"Preview must not mutate project");
 return {spaceId:rule.spaceId,passed:true,summary:result.summary};
});
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/space-preview-proof.json`,JSON.stringify({readOnly:true,spaces:results.length,results},null,2));console.log(JSON.stringify({spaces:results.length,passed:true,readOnly:true}));
