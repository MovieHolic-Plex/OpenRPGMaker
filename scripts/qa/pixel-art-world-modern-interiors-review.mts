// Check the follow-up read trace without feeding reference arrays to the model.
import fs from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
const [initial,reviewed,imageReviewed]=process.argv.slice(2);
if(!initial||!reviewed)throw Error('Usage: <initial live output> <document review output> [image review output]');
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(initial+'/result-project.json'),after=read(reviewed+'/result-project.json');
const first=read(initial+'/report.json'),report=read(reviewed+'/report.json'),calls=read(reviewed+'/tool-calls.json');
const documents=first.builds.map((build:any)=>{
 const id=build.args.id;
 const pages=calls.filter((c:any)=>c.name==='read_spatial_reference'&&c.args.id===id&&c.args.categoryId==='place-layout'&&c.args.documentId==='assembly'&&c.result.ok).map((c:any)=>c.result.data.document);
 let end=0;for(const page of pages.sort((a:any,b:any)=>a.offset-b.offset)){if(page.offset>end)break;end=Math.max(end,page.offset+page.markdown.length);}
 return {id,pages:pages.length,charactersRead:end,totalCharacters:pages[0]?.totalCharacters??0,complete:pages.length>0&&end===pages[0].totalCharacters};
});
const imageReport=imageReviewed?read(imageReviewed+'/report.json'):report;
const final=imageReviewed?read(imageReviewed+'/result-project.json'):after;
const imageCalls=imageReviewed?read(imageReviewed+'/tool-calls.json'):[];
const unchanged=[after,final].every(p=>equal(before.maps,p.maps)&&equal(before.tilesets,p.tilesets)&&equal(before.assets,p.assets));
const freshRenderCoverage=first.builds.every((b:any)=>imageReport.renders.some((r:any)=>Object.values(b.receipt.mapIds).includes(r.mapId)));
const result={unchanged,documents,freshRenderCoverage,noWriteTools:[...calls,...imageCalls].every((c:any)=>['find_tools','list_shared_scenes','inspect_shared_scene','read_spatial_reference','show_map_region','get_maps','get_map','get_map_region','get_project_summary'].includes(c.name)),errors:[...report.errors,...(imageReviewed?imageReport.errors:[])],toolFailures:[...report.toolFailures,...(imageReviewed?imageReport.toolFailures:[])],pass:unchanged&&documents.length===8&&documents.every((d:any)=>d.complete)&&freshRenderCoverage&&report.pass&&imageReport.pass};
fs.writeFileSync((imageReviewed??reviewed)+'/review-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
