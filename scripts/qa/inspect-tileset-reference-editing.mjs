import {readFile} from 'node:fs/promises';
export async function inspectReferenceEditing(page){
 const snapshot=await page.evaluate(async()=>{
  const url=(await(await fetch('/src/editor/panels/tilesetReferencePanel.ts')).text()).match(/import \{ store \} from "([^"]+)"/)[1];
  const{store}=await import(url);return JSON.stringify(store.getCurrent().tilesets.slates_32.referenceDocuments);
 });
 await page.getByTestId('tileset-reference-add-purpose').click();
 await page.getByRole('textbox',{name:'용도 이름',exact:true}).fill('임시 UI 확인');
 await page.getByRole('textbox',{name:'용도 이름',exact:true}).press('Tab');
 await page.getByTestId('tileset-reference-add-document').click();
 await page.getByTestId('tileset-reference-markdown').fill('# 편집 확인\n\n본문이 저장됩니다.');
 await page.getByTestId('tileset-reference-markdown').press('Tab');
 await page.getByTestId('tileset-reference-toggle-edit').click();
 await page.getByRole('heading',{name:'편집 확인',exact:true}).waitFor();
 const png=await readFile('docs/experiments/slates-astra-v2/house-complete.png');
 await page.getByTestId('tileset-reference-upload').setInputFiles([
  {name:'usage.md',mimeType:'text/markdown',buffer:Buffer.from('# 가져오기\n\n![조립 그림](images/tile.png)\n\n<script>window.unsafeReference=true</script>')},
  {name:'tile.png',mimeType:'image/png',buffer:png},
 ]);
 await page.getByRole('button',{name:'usage.md',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.tileset-reference-markdown img')?.naturalWidth>0);
 const edited=await page.evaluate(async()=>{
  const url=(await(await fetch('/src/editor/panels/tilesetReferencePanel.ts')).text()).match(/import \{ store \} from "([^"]+)"/)[1];const{store}=await import(url);
  const{serialize,deserialize}=await import('/src/project/io.ts');const p=deserialize(serialize(store.getCurrent()));
  const group=p.tilesets.slates_32.referenceDocuments.find(g=>g.name==='임시 UI 확인');
  if(group?.documents.length!==2||group.images.length!==1||!group.documents[0].markdown.includes('본문이 저장됩니다.')||window.unsafeReference)throw Error('UI editing/upload/escaping mismatch');
  return{created:true,markdownEdited:true,filesImported:true,relativeImageRendered:true,htmlEscaped:true,roundtrip:true};
 });
 page.once('dialog',dialog=>dialog.accept());
 await page.getByTestId('tileset-reference-manage-purpose').click();
 await page.getByRole('button',{name:'용도 삭제',exact:true}).click();
 const after=await page.evaluate(async()=>{
  const url=(await(await fetch('/src/editor/panels/tilesetReferencePanel.ts')).text()).match(/import \{ store \} from "([^"]+)"/)[1];const{store}=await import(url);return JSON.stringify(store.getCurrent().tilesets.slates_32.referenceDocuments);
 });
 if(after!==snapshot)throw Error('Deleting temporary purpose changed original content');
 return{...edited,purposeDeleted:true,originalRestored:true};
}
