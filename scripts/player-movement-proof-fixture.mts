// C1 증거용 픽스처 생성기: 예제 마을에서 일정을 가진 주민 하나에게 이동 유형 "무작위" 를 주고,
// 내보내기 플레이어가 읽는 project.json 으로 직렬화한다. 편집기 셸과 저작 테스트 게이트를 거치지
// 않고 실제 런타임을 브라우저에서 관찰하기 위한 것이다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { serialize } from "@/project/io";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";

const outPath = process.argv[2];
if (!outPath) throw new Error("usage: tmp-player-movement-fixture.mts <out.json>");

const project = createSampleAdventureProject();
const map = project.maps[project.startMapId]!;
const villager = map.events.find((event) => (event.schedule?.length ?? 0) > 0 && (event.pages?.length ?? 0) > 0);
if (!villager) throw new Error("일정을 가진 주민 이벤트가 없다");
for (const page of villager.pages!) {
  page.movement = { type: "random", speed: 6, frequency: 8 };
}
project.system = {
  ...project.system,
  timeSystem: { ...project.system.timeSystem!, minutesPerRealSecond: 1 },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, serialize(project), "utf8");
console.log(JSON.stringify({ villagerId: villager.id, x: villager.x, y: villager.y, mapId: map.id }));
