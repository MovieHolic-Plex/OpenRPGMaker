# Furniture overlapping the wall

Project `rpg-zzu-house-template-gallery` (호수 마을), canonical space
`house-catalog:room:single`, occurrence `compact-interior:example:cottage`.

The kitchen cabinet and bedroom wardrobe now overlap the northern wall by one
row: their upper 148 piece covers the wall face; their 178 base occupies the
first floor row. Wall lower tiles are preserved. The wardrobe is relocated to
bedroom (5,0); the plant moves to kitchen (3,0). Eight objects, 8×6 floor and
one interior doorway remain. All 32 passable floor cells connect.

The saved fixed-slot option `wallOverlap` locates the first floor row with x/y,
then lifts only the graphic. It is exposed to AI upsert and survives snapshots,
serialization and recompilation. Only upper pieces over actual cream wall faces
are authorized, with painted floor support in every column. Other upper objects,
stacks/events, lower wall overwrites and unsupported placements are rejected.

Validation: 81/81 focused compiler/ownership/AI-tool tests; app type gate exit 0;
cluster errors 0; exact wall/base tiles and full walking coverage; CAS save then
exact project reload and independent remote re-read; Firefox editor exact saved
map match with no errors/writes; dedicated player movement 10/10 with no errors.
Unrelated maps and the start position are preserved. See included proof JSON,
native and editor images, and runtime/SUMMARY.md.
