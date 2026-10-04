// 2차 확장 묶음 13개를 합친다. 묶음 파일은 각 담당 에이전트가 채운다(빈 묶음은 skills: []).
import type { RetroClassSkill } from "@/assets/retroClassSkills";
import type { RetroPartyPixelSheet } from "@/assets/retroRoster";
import { BATCH as a1 } from "./a1";
import { BATCH as a2 } from "./a2";
import { BATCH as a3 } from "./a3";
import { BATCH as p1 } from "./p1";
import { BATCH as p2 } from "./p2";
import { BATCH as p3 } from "./p3";
import { BATCH as p4 } from "./p4";
import { BATCH as p5 } from "./p5";
import { BATCH as b1 } from "./b1";
import { BATCH as b2 } from "./b2";
import { BATCH as b3 } from "./b3";
import { BATCH as b4 } from "./b4";
import { BATCH as b5 } from "./b5";
import { BATCH as m4 } from "./m4";
import { BATCH as m5 } from "./m5";
import { BATCH as m6 } from "./m6";

const ALL = [a1, a2, a3, p1, p2, p3, p4, p5, b1, b2, b3, b4, b5, m4, m5, m6];

export const RETRO_ROSTER_SKILLS: readonly RetroClassSkill[] = ALL.flatMap((batch) => batch.skills);
export const RETRO_PARTY_PIXEL_SHEETS: readonly RetroPartyPixelSheet[] = ALL.flatMap((batch) => batch.partyPixel ?? []);
