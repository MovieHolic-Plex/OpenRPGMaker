import { PARTY_PIXEL_SHEETS } from "@/assets/partyPixelSheets";
import { RETRO_ROSTER } from "@/assets/retroRoster";
const byChip = new Map((RETRO_ROSTER as any[]).map((r) => [r.chip, `${r.name}(${r.concept ?? ""})`.slice(0, 50)]));
for (const s of PARTY_PIXEL_SHEETS) console.log(s.chip, s.box, s.motion, byChip.get(s.chip) ?? "?");
