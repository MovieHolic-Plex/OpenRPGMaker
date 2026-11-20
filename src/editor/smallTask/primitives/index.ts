import type { SmallTaskPrimitive } from "./types";
import { CORE_PRIMITIVES } from "./core/commands";
import * as unit01 from "./units/01-cmd-dialogue";
import * as unit02 from "./units/02-cmd-flow";
import * as unit03 from "./units/03-cmd-switch-var";
import * as unit04 from "./units/04-cmd-items-shops";
import * as unit05 from "./units/05-cmd-party-actor";
import * as unit06 from "./units/06-cmd-monster-battle";
import * as unit07 from "./units/07-cmd-staging";
import * as unit08 from "./units/08-cmd-time-social";
import * as unit09 from "./units/09-cmd-move-system";
import * as unit10 from "./units/10-m2-actor-battle";
import * as unit11 from "./units/11-m2-system-menu";
import * as unit12 from "./units/12-m2-map-move";
import * as unit13 from "./units/13-m2-screen-sound";
import * as unit14 from "./units/14-m2-modern-logic";
import * as unit15 from "./units/15-cond-state-party";
import * as unit16 from "./units/16-cond-world-social";
import * as unit17 from "./units/17-db-actors-classes";
import * as unit18 from "./units/18-db-skills-states";
import * as unit19 from "./units/19-db-items-equipment";
import * as unit20 from "./units/20-db-enemies-troops";
import * as unit21 from "./units/21-db-life-farm";
import * as unit22 from "./units/22-map-tiles";
import * as unit23 from "./units/23-map-structure";
import * as unit24 from "./units/24-event-structure";
import * as unit25 from "./units/25-event-presets";
import * as unit26 from "./units/26-npc-dialogue";
import * as unit27 from "./units/27-quests";
import * as unit28 from "./units/28-project-data";
import * as unit29 from "./units/29-event-movement";
import * as unit30 from "./units/30-common-events";

export const PRIMITIVE_UNITS = [
  unit01, unit02, unit03, unit04, unit05, unit06,
  unit07, unit08, unit09, unit10, unit11, unit12,
  unit13, unit14, unit15, unit16, unit17, unit18,
  unit19, unit20, unit21, unit22, unit23, unit24,
  unit25, unit26, unit27, unit28, unit29, unit30,
] as const;

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [...CORE_PRIMITIVES, ...PRIMITIVE_UNITS.flatMap<SmallTaskPrimitive>(unit => unit.PRIMITIVES)];
