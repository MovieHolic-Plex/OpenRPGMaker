import { normalizeTerrainStamps, type TerrainStamp } from "@/project/terrainDesign";
const DB_NAME = "oprn-terrain-library", STORE = "stamps";
async function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function readTerrainLibrary(): Promise<TerrainStamp[]> {
  const db=await openLibrary();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(normalizeTerrainStamps(r.result)??[]);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function writeTerrainLibrary(stamps: TerrainStamp[], removeId?: string): Promise<void> {
  const normalized=normalizeTerrainStamps(stamps)??[];
  if(normalized.length!==stamps.length)throw new Error("올바르지 않은 도장 데이터입니다");
  const db=await openLibrary();
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),bucket=tx.objectStore(STORE);for(const stamp of normalized)bucket.put(stamp);if(removeId)bucket.delete(removeId);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export function parseTerrainLibrary(text: string): TerrainStamp[] {
  if(text.length>24*1024*1024)throw new Error("도장 파일은 24MB 이하로 나누어 주세요");
  const wire=JSON.parse(text);
  if(wire?.format!=="oprn-terrain-stamps"||wire.version!==1||!Array.isArray(wire.stamps)||wire.stamps.length>500)throw new Error("OPRN 지형 도장 파일이 아닙니다");
  const stamps=normalizeTerrainStamps(wire.stamps)??[];
  if(stamps.length!==wire.stamps.length)throw new Error("도장 일부가 손상됐습니다. 원본 파일을 확인하세요");
  return stamps;
}
