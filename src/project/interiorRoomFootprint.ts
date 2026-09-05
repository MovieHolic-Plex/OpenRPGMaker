/** A place remains one semantic room even when its floor has several rectangles. */
export const INTERIOR_ROOM_SHAPES = ['rect', 'l', 'alcove'] as const;
export type InteriorRoomShape = typeof INTERIOR_ROOM_SHAPES[number];
export type FloorBox = { readonly x:number; readonly y:number; readonly w:number; readonly h:number; readonly shape?:InteriorRoomShape };
export function isInteriorRoomShape(value:unknown): value is InteriorRoomShape {
  return typeof value === 'string' && (INTERIOR_ROOM_SHAPES as readonly string[]).includes(value);
}
export function interiorRoomRects(room:FloorBox): readonly FloorBox[] {
  if (!room.shape || room.shape === 'rect' || room.w < 7 || room.h < 5) return [room];
  const depth = 2;
  const cut = Math.max(2, Math.floor(room.w / 3));
  const inset = room.shape === 'alcove' ? Math.min(2, cut) : 0;
  return [
    {x:room.x+inset,y:room.y,w:room.w-cut-inset,h:depth},
    {x:room.x,y:room.y+depth,w:room.w,h:room.h-depth},
  ];
}
