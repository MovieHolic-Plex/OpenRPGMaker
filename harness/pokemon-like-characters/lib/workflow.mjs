import fs from 'node:fs';
import path from 'node:path';
import {ROOT,ROLES,queue,packageFor,save,read} from './store.mjs';
import {python} from './python.mjs';
export function renderDraft(draft,out){
 draft=path.resolve(draft);out=path.resolve(out);
 if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('출력 폴더가 비어 있지 않습니다. 수정본은 새 폴더에 렌더하세요');
 const r=python([path.join(ROOT,'lib/render-template.py'),'--spec',path.join(draft,'template.json'),'--candidate',path.join(draft,'candidate.json'),'--out',out],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(r.status!==0)throw Error('도트 수정안 검사 실패: '+r.stderr+r.stdout);
 return out;
}
export function newDraft(from,name,out){
 if(!ROLES.includes(from))throw Error('--from에는 templates에 나온 역할을 지정하세요');
 out=path.resolve(out);
 if(fs.existsSync(out))throw Error('이미 있는 초안은 덮어쓰지 않습니다');
 const src=path.join(ROOT,'examples',from),meta=read(path.join(src,'candidate.json'));
 fs.mkdirSync(out,{recursive:true});
 fs.copyFileSync(path.join(src,'template.json'),path.join(out,'template.json'));
 save(path.join(out,'candidate.json'),{...meta,variant:name,author:'Unspecified template editor',collection:'custom',identity:'작성 필요: 머리·복장·소품의 차이',description:'작성 필요',sourceNote:meta.sourceNote});
 const r=python([path.join(ROOT,'lib/inspect-template.py'),'--template',meta.templateId,'--out',out],{encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);
 return {draft:out,template:meta.templateId,next:'template.json의 paletteOverrides와 12포즈 patches, candidate.json의 외형 설명을 수정한 뒤 render 실행',autoApproved:0};
}
export function prepare(store){
 const ids=[];
 // Rendering occurs in scratch; failed preparation never replaces a complete collection.
 const scratch=fs.mkdtempSync(path.join(store.data,'prepare-'));
 try{
  for(const role of ROLES){
   const bundle=renderDraft(path.join(ROOT,'examples',role),path.join(scratch,role));
   const id=queue(store,bundle);packageFor(store,id);ids.push(id);
   process.stderr.write(role+' ready\n');
  }
  const wave={id:'full-cast-v1',label:'전체 캐릭터 · 16역할',candidateIds:ids,scope:'16 native walking characters / 192 poses. Pending human review.'};
  const target=path.join(store.data,'waves',wave.id+'.json');save(target+'.tmp',wave);fs.renameSync(target+'.tmp',target);
  return {roles:ids.length,poses:192,candidateIds:ids,data:store.data,autoApproved:0};
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
