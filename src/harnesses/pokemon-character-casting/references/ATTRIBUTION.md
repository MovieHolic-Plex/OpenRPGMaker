# Emerald distinct NPC walking bases

Original artwork: Nintendo / Game Freak / Creatures. Source: pret/pokeemerald.
These are actual original-game sprites, not independently authored Codex art.
No new license or ownership is asserted for the graphics.

Six distinct walking bases: Wally, May, Hiker, Sailor, Camper and Expert male.
Each144×32indexed source contains9native16×32cells. Source URLs and pinnedSHA256
are recorded in sources.json. Transparent source palette index0, native crops,
standard phase mapping and original right-facing flips only; no shrinking,
quantization, automatic tracing or synthesized poses.

The user rejected same-body/head-and-palette variants and asked for other
characters using the original walking reference. The candidate wave now adopts
six different source bodies/faces/outfits/gaits. Each stays pending until the
user selects Allow; no original source is silently declared new hand drawing.

Frame mapping: https://github.com/pret/pokeemerald/blob/master/src/data/object_events/object_event_anims.h

The complete cast adds pinned walking templates for Brendan, Professor Birch, mart employee, mother, woman3, man3, black belt, Devon employee, man1, schoolboy, bug catcher and gentleman. `sources.json` records exact URLs and hashes (and a scientist reference examined during selection). The full-cast candidates explicitly edit these originals; their palettes/row operations and original/edited comparison images are preserved alongside each candidate. No new license or independent ownership is claimed for the underlying game sprites.

The theme cast (theme-cast-v1: desert / snow / coast townsfolk and route trainers) adds pinned walking templates for Poké Fan male, woman2, man4, fat man, woman5, boy1, fisherman, woman1 and youngster, with exact pret/pokeemerald URLs and SHA256 in `sources.json`. Claude (Opus 5.5) authored explicit head/clothing row edits and palette choices on these originals (`harness-data/pokemon-character-casting/templates/theme-cast-v1/cast.json`); bodies, faces and gait poses remain original. No new license or independent ownership is claimed.
