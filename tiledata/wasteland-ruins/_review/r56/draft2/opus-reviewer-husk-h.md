**husk-h verdict.** Pixel locations are on the 384×384 gate image at 4x; one cell is 64px.

**What works**
- **Rule 1 (3/4 view):** passes. Rows 0 to about 125 are a clear roof plane: grey gravel slab on the west, three rooftop units and a pipe, all inside a light tan parapet ring with a dark brown outline. The front façade is below, and there are no side faces. Both outer edges have outlines: dark brown (47,36,24) on the plaster, dark slate (42,53,57) on the shop storey. Nothing is black.
- **Rule 2 (multi-storey):** passes. It reads as 3 storeys at 1x. There is a window row at y about 160–190, a 6-window row at y about 225–255, and a grey shop storey from y about 270 down.
- **Rule 4 (distinct):** passes. It is the only wide, warm-plaster block. Its footprint and material differ from husk-a, husk-b, husk-tall and husk-e (grey or brick) and from husk-f and husk-g (grey and mint, tall).
- **Rule 5 (no text, faces, generated look):** passes. The shutter slats and the three fascia notches line up with the shop pillars, so they read as structure, not lettering.
- **Rule 6 (damage):** passes, and it does not repeat the husk-c fault.
  - The east roof is a slab that has dropped down inside an intact parapet. It is not a straight 45° band reaching the façade. Its lower edge is jagged, with hanging bricks and rubble at about x 260–360, y 100–110.
  - Below it, the missing top-floor front exposes the brown back wall with dark openings. There is a ragged grey rubble lip with light plaster caps at about x 200–330, y 160–200.
  - Ground floor: the west shutter is half raised over a dark interior, the middle shutter has rust drips, and the east display glass is cracked with debris in front. That reads as abandoned, not trading.
- **Rule 3 (quality):** passes. Shading has 3–4 steps per material and there are no flat fills.

**Nits (not blocking)**
1. **The roof collapse is a bit shallow, as the judges said.** The fallen slab at about x 210–370, y 25–110 is a single grey plane with almost even tone, so at 1x it is close to "tilted panel". Fix: darken the bottom 2px of the slab toward the break, 1px light lip along its upper hinge edge, 2–3 dark void pixels between the slab's lower edge and the back wall.
2. **Three similar red brick chunks sit in a nearly even row** at about y 105, x 265 / 315 / 410. Break the rhythm.
3. **The window sills on the lower window row (y about 255–270) have two vertical drop lines each.** They read slightly like small tables. Shorten to 1px stubs.
4. **The plaster front is blotchier than husk-tall's concrete.** Merge about a third of the isolated light specks into larger stain shapes.
5. **The middle rooftop unit's "v" fan mark** at about x 105–125, y 55–65 should get a third pixel so it can't read as a tiny glyph or face.

VERDICT husk-h: PASS
