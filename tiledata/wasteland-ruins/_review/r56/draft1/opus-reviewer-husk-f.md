**husk-f verdict.** I reviewed it against the modern-city reference, the existing husks, husk-g and husk-h, and the r55 faults.

**What passes:**
- **Rule 1 (3/4 view), roof side:** the roof reads as a top plane. It is brown gravel with a light parapet band along the top (y 0–20) and the left (x 0–20), and a light wall-top band at y 165–185. The stair housing and debris on the roof are clean. There are no side faces.
- **Rule 2 (storeys):** four storeys are readable at 1x. There are window rows at y≈215, 280, 345 and 405, with slab bands between them. Balconies on alternating bays break up the grid.
- **Rule 3 (quality):** the facade matches the modern-city reference and husk-tall. Windows have dark navy glass with a diagonal glint. Sills are lit. The concrete has two tones, rust drips run under the balconies, and ivy grows in two places. There is no black outline.
- **Rule 4 (distinct):** it is distinct. It is grey concrete at 5×7 with balconies. husk-g is a mint-green curtain-wall tower, husk-h is a yellow shopfront block and husk-tall is beige.
- **Rule 5 (no text):** no text or faces. The balcony grilles are evenly spaced vertical bars, which is acceptable.

**Faults:**

1. **Rule 6 fails. The collapse at the top right (4x x≈230–320, y≈20–250) does not read as damage.** It is one mush of mid-grey, about the same value as the facade concrete. It has no lit slab tops, no dark voids and no shadow. At 1x (see buildings-new-vs-existing-1x) it reads as a pale grey annex or stair wing bolted onto the roof, not a caved-in corner.
   - **Left edge:** a near-vertical seam at x≈232 from y 50 to 165. Rust ticks sit on it at a regular spacing of about 20px at 4x (5px native). It looks drawn with a ruler, not broken.
   - **Lower edge:** a straight diagonal from (232,195) to (320,250), with evenly spaced rust dots. This is the same "straight band reads as ramp" fault that failed husk-c in r55.
   - **Facade overlap:** the zone covers the top-floor right bay (x 240–320, y 185–250) with no window remnant. That makes it ambiguous whether this area is roof or front.
   - **Fix, steps:** redo the zone as 2–3 stepped broken slab edges at the floor lines. Use roof level at y≈20, the 4th-floor slab at y≈110 and the 3rd-floor slab at y≈185.
   - **Fix, step detail:** give each step a 2px light top (wall-top light grey), then a 1px dark slate broken lip, then a 4–8px darker exposed front strip with a half window or dark void under it.
   - **Fix, voids and rebar:** fill the voids behind each step with the facade's dark navy/slate interior, at least 2 shades darker than the slab. Make the left and lower boundaries ragged with ±1–3px native jitter. Space the rebar irregularly in 2–3 clusters, not every 5px.
   - **Fix, bottom of the break:** put a window remnant in the top-floor right bay below the break at y≈200–230. Add a small rubble cone at the facade's bottom right (x 270–320, y 400–448). The rubble already there is very light.
2. **Minor:** the facade below the break is undamaged, so apart from the corner it looks like an empty but intact block. One more blown-out window (dark void with a ragged sill, for example 3rd row, right bay at 4x x 260–300, y 330–360) would tie the facade to the ruin.
3. **Nit:** the concrete fill is close to flat mid-grey in the large wall areas between bays, for example x 150–180 on every floor. One extra darker stain or crack per floor would help.

VERDICT husk-f: FAIL
