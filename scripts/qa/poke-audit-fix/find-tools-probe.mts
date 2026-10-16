// 몬스터 전투 깊이 기능 find_tools 질의 → 상위 5개 점검. bun scripts/qa/poke-audit-fix/find-tools-probe.mts
import { getTool } from "@/editor/tools";
const findTools = getTool("find_tools")!;
const cases: readonly (readonly [string, string])[] = [
  ["특성", "define_monster_species"], ["몬스터 특성 만들기", "define_monster_species"], ["ability immuneType", "define_monster_species"],
  ["독 걸리게", "upsert_state"], ["맹독 상태", "upsert_state"], ["혼란", "upsert_state"], ["toxic confusion status", "upsert_state"],
  ["조건부 볼", "upsert_item"], ["그물볼", "upsert_item"], ["capture ball condition", "upsert_item"], ["포획볼 퀵볼 타이머볼", "upsert_item"],
  ["지닌 물건", "upsert_item"], ["heldEffect", "upsert_item"], ["held item", "upsert_item"], ["열매 지니게 하기", "upsert_item"],
  ["날씨", "upsert_skill"], ["몬스터 날씨", "upsert_skill"], ["포켓몬 날씨 기술", "upsert_skill"], ["몬스터 전투 날씨 쾌청", "upsert_skill"], ["weather rain sandstorm", "upsert_skill"], ["모래바람 싸라기눈", "upsert_skill"],
  ["비전머신", "place_field_obstacle"], ["낚시", "configure_fishing"],
];
let bad = 0;
for (const [query, want] of cases) {
  const result = findTools.run({} as never, { query } as never) as { data?: { matches?: { name: string }[] } };
  const top = (result.data?.matches ?? []).slice(0, 5).map((m) => m.name);
  const rank = top.indexOf(want);
  const ok = rank >= 0 && rank <= (query === "날씨" ? 2 : 1);
  if (!ok) bad += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${query.padEnd(24)} want=${want} rank=${rank}  ${top.join(", ")}`);
}
console.log(bad ? `${bad} misses` : "all ok");
