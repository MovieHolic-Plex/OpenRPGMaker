// Browser-only inspection of the real schema, tool adapter and provider delivery boundary.
// No provider request, test runner or authored map mutation.
export async function inspectReferenceContract(page,raw){
 return page.evaluate(async raw=>{
  const {deserialize,serialize}=await import('/src/project/io.ts');
  const {PiTilesetReferenceGate}=await import('/src/ai/piAgent/tilesetReferenceGate.ts');
  const {createPiToolset,resolvePiToolShape}=await import('/src/ai/piAgent/toolAdapter.ts');
  const {prepareWebExport}=await import('/src/project/webExport.ts');
  const p=deserialize(raw), owner=p.tilesets.slates_32;
  const original=structuredClone(owner.referenceDocuments);
  const image=structuredClone(original[0].images[0]);
  owner.referenceDocuments=[{id:'village',name:'마을',description:'',documents:[{id:'guide',name:'guide.md',markdown:'가'.repeat(12001)}],images:[image]}];
  const ctx={project:p};const args={mapId:'slates_astra_v3_walled_50',referencePurpose:'village'};
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const outcomes={};
  for(const provider of ['responses','chat','anthropic','gemini']){
   const gate=new PiTilesetReferenceGate();
   const adapter=createPiToolset(ctx,{referenceGate:gate});const read=adapter.find(t=>t.name==='read_tileset_reference');
   assert(gate.beforeWrite(p,'paint_tiles',args),'unread allowed');
   assert(gate.beforeWrite(p,'apply_spatial_build',{designId:'internally-resolved',referencePurpose:'village'}),'unknown scope bypassed reading');
   const results=[];
   for(const offset of [0,6000,12000])results.push(await read.execute('doc-'+offset,{tilesetId:'slates_astra_v3_32',categoryId:'village',documentId:'guide',offset}));
   results.push(await read.execute('image',{tilesetId:'slates_astra_v3_32',categoryId:'village',imageId:image.id}));
   assert(results.at(-1).content.some(p=>p.type==='image'),'image bytes absent');
   assert(gate.beforeWrite(p,'paint_tiles',args),'same response read bypass');
   const texts=results.map(r=>r.content.find(c=>c.type==='text').text);
   const toPayload=(images=true)=>{
    const data=image.dataUrl.split(',')[1];
    if(provider==='responses')return{input:[...texts.map(output=>({type:'function_call_output',call_id:'read',output})),{role:'user',content:images?[{type:'input_image',image_url:image.dataUrl}]:[]}]};
    if(provider==='chat')return{messages:[...texts.map(content=>({role:'tool',tool_call_id:'read',content})),{role:'user',content:images?[{type:'image_url',image_url:{url:image.dataUrl}}]:[]}]};
    if(provider==='anthropic')return{messages:[{role:'user',content:[...texts.map(text=>({type:'tool_result',tool_use_id:'read',content:[{type:'text',text}]})),...(images?[{type:'image',source:{type:'base64',media_type:'image/png',data}}]:[])]}]};
    return{request:{contents:[{role:'user',parts:[...texts.map(output=>({functionResponse:{name:'read_tileset_reference',response:{output}}})),...(images?[{inlineData:{mimeType:'image/png',data}}]:[])]}]}};
   };
   gate.payload(toPayload());gate.complete(false);assert(gate.beforeWrite(p,'paint_tiles',args),'provider failure credited');
   gate.payload(toPayload(false));gate.complete(true);assert(gate.beforeWrite(p,'paint_tiles',args),'text-only delivery credited image');
   gate.payload(toPayload());assert(gate.beforeWrite(p,'paint_tiles',args),'payload attempt credited before response');
   gate.complete(true);assert(!gate.beforeWrite(p,'paint_tiles',args),provider+' complete read still blocked');
   owner.referenceDocuments[0].documents[0].markdown+='수정';assert(gate.beforeWrite(p,'paint_tiles',args),'stale reference allowed');owner.referenceDocuments[0].documents[0].markdown=owner.referenceDocuments[0].documents[0].markdown.slice(0,-2);
   outcomes[provider]='blocked before delivery; text without image blocked; complete delivery accepted; edits revoke';
  }
  const clipped=new PiTilesetReferenceGate(), reader=createPiToolset(ctx,{referenceGate:clipped}).find(t=>t.name==='read_tileset_reference');
  const response=await reader.execute('clip',{tilesetId:'slates_32',categoryId:'village',documentId:'guide',offset:0});
  const payload=JSON.parse(response.content[0].text);payload.data.document.markdown='잘린 본문';
  clipped.payload({messages:[{role:'tool',content:JSON.stringify(payload)}]});clipped.complete(true);
  assert(clipped.beforeWrite(p,'paint_tiles',args),'clipped body allowed');
  assert(resolvePiToolShape(ctx,'tile_erase',{toolNames:['tile_erase']})?.name==='tile_erase','fallback resolved wrong tool');
  const legacy=structuredClone(p);for(const ts of Object.values(legacy.tilesets)){delete ts.referenceDocuments;delete ts.referenceSourceTilesetId;}
  assert(!deserialize(serialize(legacy)).tilesets.slates_32.referenceDocuments,'legacy gained references');
  const bad=structuredClone(p);bad.tilesets.slates_32.referenceSourceTilesetId='missing';delete bad.tilesets.slates_32.referenceDocuments;
  let rejected=false;try{deserialize(serialize(bad));}catch{rejected=true;}assert(rejected,'dangling source allowed');
  const web=prepareWebExport(p);assert(Object.values(web.project.tilesets).every(t=>!t.referenceDocuments&&!t.referenceSourceTilesetId),'runtime export carries author references');assert(owner.referenceDocuments,'export mutated author project');
  owner.referenceDocuments=original;
  assert(JSON.stringify(deserialize(serialize(p)).tilesets.slates_32.referenceDocuments)===JSON.stringify(original),'document roundtrip changed');
  return{providers:outcomes,truncatedTextRejected:true,legacyPreserved:true,danglingSourceRejected:true,runtimeExcludesReferences:true,authorRoundtrip:true};
 },raw);
}
