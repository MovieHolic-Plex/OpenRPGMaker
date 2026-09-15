/** Wide activity boundaries have no fixed doorway; whole-floor reachability
 * chooses the usable approach after furniture placement. Narrow door openings keep every cell reserved. Furniture still goes
 * through the composer's whole-floor connectivity preflight.
 */
export function interiorActivityEntries(mask: readonly boolean[], fullFloor: readonly boolean[], width: number, height: number, openPlan = false) {
  const result: {x:number;y:number;dx:number;dy:number}[] = [];
  const at = (cells: readonly boolean[], x:number,y:number) => x>=0 && y>=0 && x<width && y<height && cells[y*width+x] === true;
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
    const lines = new Map<number, number[]>();
    for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
      if (!at(mask,x,y) || !at(fullFloor,x+dx,y+dy) || at(mask,x+dx,y+dy)) continue;
      const fixed = dx ? x : y, along = dx ? y : x;
      const points = lines.get(fixed) ?? []; points.push(along); lines.set(fixed,points);
    }
    for (const [fixed, points] of lines) {
      points.sort((a,b)=>a-b);
      for (let start=0;start<points.length;) {
        let end=start+1; while(end<points.length && points[end]===points[end-1]!+1) end++;
        const selected = openPlan && end-start>=3 ? [] : points.slice(start,end);
        for(const along of selected) result.push({x:dx?fixed:along,y:dx?along:fixed,dx:dx ? -dx : 0,dy:dy ? -dy : 0});
        start=end;
      }
    }
  }
  return result;
}
