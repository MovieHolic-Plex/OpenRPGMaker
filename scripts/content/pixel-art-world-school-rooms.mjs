// Extract whole, bounded rooms from the saved school; no new source pixels.
export function extractSchoolRooms(project, school) {
  return school.floors.flatMap(floor => {
    const map = project.maps[floor.id];
    if (!map || ['lowerTiles', 'upperTiles'].some(layer => JSON.stringify(map[layer]) !== JSON.stringify(floor[layer]))) {
      throw Error('School room source differs from the reviewed floor: ' + floor.id);
    }
    return floor.rooms.map(room => {
      const north = room.door.y >= room.y + room.height;
      const origin = {x: room.x - 1, y: room.y - 1};
      const width = room.width + 2, height = room.height + (north ? 5 : 2);
      if (origin.x < 0 || origin.y < 0 || origin.x + width > map.width || origin.y + height > map.height) throw Error('Room crop outside floor');
      const inside = p => p.x >= origin.x && p.y >= origin.y && p.x < origin.x + width && p.y < origin.y + height;
      const local = p => ({...p, x: p.x - origin.x, y: p.y - origin.y});
      const placements = floor.placements.filter(p => inside(p) && inside({x:p.x+p.width-1, y:p.y+p.height-1}));
      // No half furniture is allowed at the extraction boundary.
      for (const p of floor.placements) {
        const overlaps = p.x < origin.x+width && p.x+p.width > origin.x && p.y < origin.y+height && p.y+p.height > origin.y;
        if (overlaps && !placements.includes(p)) throw Error('Room crop cuts furniture: ' + p.recipeId);
      }
      const crop = layer => Array.from({length:height}, (_,y) => map[layer].slice((origin.y+y)*map.width+origin.x, (origin.y+y)*map.width+origin.x+width)).flat();
      return {id: 'paw-room-'+room.id, name: room.name, kind:room.kind, level:floor.level,
        sourceMapId:map.id, sourceOrigin:origin, width, height, tilesetId:map.tilesetId,
        lowerTiles:crop('lowerTiles'), upperTiles:crop('upperTiles'),
        spawn:local(room.center), door:local(room.door),
        entry:{x:room.door.x-origin.x, y:north?height-1:0},
        placements:placements.map(local), approaches:floor.approaches.filter(inside).map(local),
        sourceRoom:room, events:[],
        limitation:'독립 실내 표본. 복도·다른 방·계단·외부 전이·가구 상호작용은 포함하지 않는다.'};
    });
  });
}
