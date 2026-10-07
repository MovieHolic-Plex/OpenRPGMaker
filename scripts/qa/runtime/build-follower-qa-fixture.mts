// 팔로워(몬스터 뒤따르기) 런타임 QA 픽스처 생성기 — 수 MB JSON을 커밋하지 않고
// 필요할 때 다시 만든다: npx vite-node --script scripts/qa/runtime/build-follower-qa-fixture.mts
//
// 만들어지는 것(test/fixtures/projects/follower-qa-pokemon.json, gitignored):
//   createScarloxyPokemonDemoProject + 스타터 autorun 이벤트(ev_follower_qa_give).
//   autorun 페이지가 giveMonster 1회 후 셀프스위치 A로 닫힌다 → 새 게임에서
//   monsterParty 1 + 필드 팔로워 열차 1이 보장된다.
//   species.graphic.fieldCharsetId 를 tex_easyrpg_charset_monster1 로 강제한다 —
//   종족 기본 몬스터 시트는 방향 전환이 시트에 반영되지 않는다(걷기 프레임 검증에 방해).
// qa 하네스 픽스처 로더는 v3 계약(version 3)을 전제하므로 version: 3 으로 직렬화한다.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { giveMonster } from "@/project/monsterCollection";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";

let project = createScarloxyPokemonDemoProject();
if (project.version !== 3) {
  project = { ...project, version: 3 };
}
const speciesId = scarloxySpeciesId("sparchu");
const species = project.database.monsterSpecies?.find((record) => record.id === speciesId);
if (species) species.graphic = { ...species.graphic, fieldCharsetId: "tex_easyrpg_charset_monster1" };
const mapId = project.startMapId;
const map = project.maps[mapId]!;
const eventId = "ev_follower_qa_give";
map.events.push({
  id: eventId,
  name: "팔로워 QA 지급",
  x: project.startPos.x - 1,
  y: project.startPos.y,
  trigger: { kind: "action" },
  commands: [],
  pages: [
    {
      id: eventId + "_give",
      name: "자동 지급",
      conditions: [],
      trigger: { kind: "auto" },
      priority: "same",
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 0 },
      movement: { type: "fixed", speed: 4, frequency: 4 },
      commands: [
        { kind: "giveMonster", speciesId, level: 5, nickname: "파랑이" },
        { kind: "setSelfSwitch", key: "A", value: true },
      ],
    },
    {
      id: eventId + "_done",
      name: "지급 완료",
      conditions: [{ kind: "selfSwitch", key: "A", value: true }],
      trigger: { kind: "action" },
      priority: "same",
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 0 },
      movement: { type: "fixed", speed: 4, frequency: 4 },
      commands: [],
    },
  ],
} as never);

const out = resolve(import.meta.dirname ?? ".", "../../../test/fixtures/projects/follower-qa-pokemon.json");
writeFileSync(out, JSON.stringify(project, null, 2));
console.log(JSON.stringify({ out, speciesId, eventId }));
