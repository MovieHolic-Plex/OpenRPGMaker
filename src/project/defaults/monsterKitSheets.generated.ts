// 생성 파일 — src/harnesses/tileset-authoring/lib/wire.py 가 쓴다. 손으로 고치지 않는다.
// 몬스터 수집 손 도트 시트(지역별)의 정의 JSON 정적 import 표.
import s0 from "@/assets/monsterKit/monster-climate.json";
import s1 from "@/assets/monsterKit/monster-coast.json";
import s2 from "@/assets/monsterKit/monster-dungeon.json";
import s3 from "@/assets/monsterKit/monster-gyms.json";
import s4 from "@/assets/monsterKit/monster-overworld.json";
import s5 from "@/assets/monsterKit/monster-rooms.json";
import s6 from "@/assets/monsterKit/monster-wild.json";

export const MONSTER_KIT_SHEET_DATA: Record<string, unknown> = {
  "tex_monster_climate": s0,
  "tex_monster_coast": s1,
  "tex_monster_dungeon": s2,
  "tex_monster_gyms": s3,
  "tex_monster_overworld": s4,
  "tex_monster_rooms": s5,
  "tex_monster_wild": s6,
};
