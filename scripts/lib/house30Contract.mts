import type { SectionStructureKitDef } from "../../src/project/types";

/** A reusable exterior. Visible floors are metadata, not implied interior maps. */
export type House30Entry = {
  number: number;
  name: string;
  description: string;
  family: string;
  floors: 1 | 2 | 3 | 4;
  doors: { x: number; y: number }[];
  kit: SectionStructureKitDef;
};

export const HOUSE30_TAG = "집 형태 30종 20260912";
export const HOUSE30_EXCLUDED_TILES = [196, 197, 226, 227, 256, 257] as const;
