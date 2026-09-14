# Furnished compact house

Project `rpg-zzu-house-template-gallery` (호수 마을), space
`house-catalog:room:single`, occurrence `compact-interior:example:cottage`.

The existing 8×6 divided room keeps eight furnishings. Kitchen water aligns with
the north cooking/storage area. A compact single-person dining table sits lower
in the living area with space on both sides. The bed moves into the northeast
corner, grouped with a bedside table and plant; storage moves to the southeast.
The bedside table and dining assembly reuse upper-layer tiles 328 and 298.
They are saved objects referenced by the space for subsequent AI builds.

Validation: actual spatial refresh; idempotent registration; cluster errors zero;
all 30 passable floor cells reachable without crossing the exit trigger; closing
the internal doorway still disconnects the two rooms. CAS save followed by exact
reload and independent remote read succeeded. Unrelated maps and start position
are preserved. Firefox editor QA passed with no errors/writes and exact saved-map
match. Dedicated player QA passed 10/10 walking beats with no runtime errors.

This change authors content and its QA routes only; it changes no engine/schema.
See JSON proofs, native render and editor screenshots, and runtime/SUMMARY.md.
The previous placement is preserved in ../unified-interior-walls/interior-4x.png.
