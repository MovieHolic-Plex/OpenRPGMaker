import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import type { Command, GameEvent, GameMap } from "@/project/types";

const say = (body: string, speaker = ""): Command => ({ kind: "text", body, speaker }) as Command;
const ev = (id: string, x: number, commands: Command[]): GameEvent => ({ id, name: "", x, y: 2, pages: [{ id: `${id}_p`, trigger: "action", conditions: [], commands }] }) as unknown as GameEvent;
const fight = (pre: string): Command[] => [say(pre), { kind: "battleProcessing", troopId: "t1", defeatBranch: [say("눈앞이 캄캄해졌다… 정신을 잃었다.")], escapeBranch: [say("다시 준비해서 돌아오자 꼭.")] } as unknown as Command];

function monsterTowns() {
  const before = createBlankProject();
  const after = structuredClone(before);
  const base = Object.values(after.maps)[0]!;
  const map = (id: string, name: string): GameMap => ({ ...structuredClone(base), id, name, events: [] });
  const home = map("mx_map_home", "새싹마을");
  const grove = map("mx_map_grove", "새순 마을");
  home.events.push(
    ev("mx_map_home_to_mx_map_meadow", 1, [say("아직 1번길로 갈 때가 아니다.")]),
    ev("mx_map_home_to_mx_map_meadow_edge_14_0", 2, [say("아직 1번길로 갈 때가 아니다.")]),
    ev("mx_map_home_mvp_nurse", 3, [say("동료들이 지쳤구나. 내가 기운을 북돋아 줄게!", "회복 도우미")]),
    ev("mx_map_home_trainer_0", 4, fight("첫 번째 트레이너의 도전이다!")),
    ev("ev_npc_aaa", 5, [say("오늘 바람이 유난히 차갑네요, 조심해요.")]),
  );
  grove.events.push(
    ev("mx_map_grove_to_mx_map_meadow", 1, [say("아직 1번길로 갈 때가 아니다.")]),
    ev("mx_map_grove_mvp_nurse", 3, [say("동료들이 지쳤구나. 내가 기운을 북돋아 줄게!", "회복 도우미")]),
    ev("mx_map_grove_trainer_0", 4, fight("두 번째 트레이너의 도전이다!")),
    ev("ev_npc_bbb", 5, [say("오늘 바람이 유난히 차갑네요, 조심해요.")]),
  );
  after.maps = { ...after.maps, [home.id]: home, [grove.id]: grove };
  return { before, after };
}

describe("scene repeat — builder copies of one door or one role", () => {
  it("does not send door width copies, same-role town NPCs or battle outcome lines back to the model", () => {
    const { before, after } = monsterTowns();
    const repeats = sceneCraftFindings(before, after, "몬스터 게임을 만들어 줘").filter((f) => f.id === "repeat");
    expect(repeats).toHaveLength(1);
    expect(JSON.stringify(repeats[0])).toContain("ev_npc_bbb");
  });
});
