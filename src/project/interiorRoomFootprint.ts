/** A place remains one semantic room even when its floor has several rectangles. */
export const INTERIOR_ROOM_SHAPES = [
  "rect",
  "l",
  "alcove",
  "l-right",
  "bay",
  "notch",
  "cross",
] as const;
export type InteriorRoomShape = (typeof INTERIOR_ROOM_SHAPES)[number];
export type FloorBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly shape?: InteriorRoomShape;
};
export function isInteriorRoomShape(
  value: unknown,
): value is InteriorRoomShape {
  return (
    typeof value === "string" &&
    (INTERIOR_ROOM_SHAPES as readonly string[]).includes(value)
  );
}
export function interiorRoomRects(room: FloorBox): readonly FloorBox[] {
  if (!room.shape || room.shape === "rect" || room.w < 7 || room.h < 5)
    return [room];
  const box = (x: number, y: number, w: number, h: number): FloorBox => ({
    x: room.x + x,
    y: room.y + y,
    w,
    h,
  });
  if (room.shape === "l-right")
    return [box(2, 0, room.w - 2, 2), box(0, 2, room.w, room.h - 2)];
  if (room.shape === "bay")
    return [box(0, 0, room.w, room.h - 2), box(2, room.h - 2, room.w - 4, 2)];
  if (room.shape === "notch")
    return [
      box(0, 0, room.w, 2),
      box(2, 2, room.w - 2, 2),
      box(0, 4, room.w, room.h - 4),
    ];
  if (room.shape === "cross")
    return [
      box(2, 0, room.w - 4, 2),
      box(0, 2, room.w, room.h - 4),
      box(2, room.h - 2, room.w - 4, 2),
    ];
  const depth = 2;
  const cut = Math.max(2, Math.floor(room.w / 3));
  const inset = room.shape === "alcove" ? Math.min(2, cut) : 0;
  return [
    { x: room.x + inset, y: room.y, w: room.w - cut - inset, h: depth },
    { x: room.x, y: room.y + depth, w: room.w, h: room.h - depth },
  ];
}
