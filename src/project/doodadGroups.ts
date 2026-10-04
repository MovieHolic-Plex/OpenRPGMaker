/** Editor grouping only; gameplay continues to use the authored tiles and their collision. */
export interface DoodadGroup {
  id: string;
  label: string;
  kitId: string;
  cells: { index: number; tile: number; before: number }[];
}

export function normalizeDoodadGroups(value: unknown, count: number): DoodadGroup[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids=new Set<string>(), occupied=new Set<number>(), out:DoodadGroup[]=[];
  for (const g of value) {
    if (!g || typeof g!=="object" || typeof g.id!=="string" || !g.id || ids.has(g.id) || typeof g.label!=="string" || typeof g.kitId!=="string" || !Array.isArray(g.cells)) continue;
    const cells:DoodadGroup["cells"]=[], seen=new Set<number>();
    for (const c of g.cells) {
      if (!c || !Number.isInteger(c.index) || c.index<0 || c.index>=count || seen.has(c.index) || occupied.has(c.index)
        || !Number.isInteger(c.tile) || c.tile<0 || !Number.isInteger(c.before) || c.before< -1) continue;
      seen.add(c.index); cells.push({index:c.index,tile:c.tile,before:c.before});
    }
    if (!cells.length) continue;
    ids.add(g.id); for (const c of cells) occupied.add(c.index);
    out.push({id:g.id,label:g.label,kitId:g.kitId,cells});
  }
  return out.length ? out : undefined;
}

export function remapDoodadGroups(groups: readonly DoodadGroup[], count: number, sourceIndex: (target:number)=>number): DoodadGroup[] {
  const targets=new Map<number,number>();
  for (let t=0;t<count;t++) { const from=sourceIndex(t); if (from>=0) targets.set(from,t); }
  return groups.flatMap(g=>{
    const cells=g.cells.flatMap(c=>{const index=targets.get(c.index);return index===undefined?[]:[{...c,index}];});
    return cells.length?[{...g,cells}]:[];
  });
}
