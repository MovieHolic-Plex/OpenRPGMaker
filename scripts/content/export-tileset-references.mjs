// Extract current project-owned references for coding agents with filesystem vision tools.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const [input,tilesetId,out]=process.argv.slice(2);
if(!input||!tilesetId||!out)throw Error('Usage: node scripts/content/export-tileset-references.mjs <project.json> <tilesetId> <new-directory>');
const project=JSON.parse(await readFile(input,'utf8'));
const tileset=project.tilesets[tilesetId];if(!tileset)throw Error('Tileset missing');
const owner=tileset.referenceSourceTilesetId?project.tilesets[tileset.referenceSourceTilesetId]:tileset;
if(!owner||owner.referenceSourceTilesetId)throw Error('Reference source missing or chained');
await mkdir(out); // Refuse to overwrite previous reading evidence.
const manifest={tilesetId,ownerId:owner.id,categories:[]};
for(const group of owner.referenceDocuments??[]){
 if(!/^[\w.-]{1,100}$/.test(group.id)||group.id==='.'||group.id==='..')throw Error('Unsafe category ID');
 const folder=join(out,group.id);await mkdir(folder);await mkdir(join(folder,'images'));
 const images=[];
 for(const image of group.images){
  if(!/^[\w.-]{1,100}$/.test(image.id)||image.id==='.'||image.id==='..')throw Error('Unsafe image ID');
  // Shipped images are static paths under public/ (scripts/content/externalize-reference-images.mjs).
  const bundled=image.dataUrl.match(/^\/assets\/(?:[\w-]+\/)*[\w.-]+\.(png|jpe?g|webp)$/);
  const match=bundled?null:image.dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);if(!bundled&&!match)throw Error('Unsupported image');
  const ext=bundled?bundled[1].replace('jpg','jpeg'):match[1];
  const file=`images/${image.id}.${ext}`;await writeFile(join(folder,file),bundled?await readFile(join('public',image.dataUrl)):Buffer.from(match[2],'base64'));
  images.push({id:image.id,name:image.name,caption:image.caption,file});
 }
 const documents=[];
 for(const doc of group.documents){
  if(!/^[\w.-]{1,100}$/.test(doc.id)||doc.id==='.'||doc.id==='..')throw Error('Unsafe document ID');
  let markdown=doc.markdown;for(const image of images)markdown=markdown.replaceAll(`(image:${image.id})`,`(${image.file})`);
  const file=`${doc.id}.md`;await writeFile(join(folder,file),markdown);documents.push({id:doc.id,name:doc.name,file});
 }
 manifest.categories.push({id:group.id,name:group.name,description:group.description,documents,images});
}
await writeFile(join(out,'INDEX.json'),JSON.stringify(manifest,null,2));console.log({out,ownerId:owner.id,categories:manifest.categories.length});
