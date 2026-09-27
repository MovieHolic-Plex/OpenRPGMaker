// 알려진 MV/MZ 팩 프리셋. 사용자가 올린 시트를 이 목록의 해시와 맞춰 알아본다.
import type { MvPackPreset } from "../packPreset";
import { RASAK_MODERN_CITY } from "./rasakModernCity";
import { REFMAP_SET_PRESETS } from "./refmapSets";
import { REFMAP_TOWN_OUTSIDE } from "./refmapTownOutside";

export const MV_PACK_PRESETS: readonly MvPackPreset[] = [RASAK_MODERN_CITY, REFMAP_TOWN_OUTSIDE, ...REFMAP_SET_PRESETS];
