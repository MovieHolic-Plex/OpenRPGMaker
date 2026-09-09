import type { MonsterMetadata } from "@/project/types";
import monsterCatalogData from "./monsterCatalogData.json";

/** Original-artwork observations and source hashes are recorded in monsterCatalogReview.json. */
export const MONSTER_CATALOG: Readonly<Record<string, MonsterMetadata>> = Object.freeze(monsterCatalogData);
