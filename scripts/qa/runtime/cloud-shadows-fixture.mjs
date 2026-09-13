// QA 전용 픽스처: 구름 그림자 «만» 움직이는 정적 맵을 만든다.
//
// 왜 손대는가: 게임 콘텐츠 픽스처의 시작 맵에는 배회 NPC 와 필드 스폰이 있다. 그것들이
// 두 프레임 사이에 움직이면 픽셀 차이가 생겨 «구름 때문에 달라진 픽셀» 을 증명할 수 없다.
// 그래서 QA 사본에서만 이벤트·스폰을 비운다(원본 JSON 은 읽기만 한다).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = resolve(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const MAP_ID = "map_lantern_village";

export async function writeCloudShadowFixture({ enabled, settings = {} }) {
  const project = JSON.parse(await readFile(SOURCE, "utf8"));
  const map = project.maps[MAP_ID];
  if (!map) throw new Error(`픽스처에 ${MAP_ID} 가 없다`);

  map.events = [];
  delete map.fieldSpawns;
  delete map.roguelikeRoom;
  delete map.encounterRate;
  delete map.minimap;
  if (enabled) map.cloudShadows = { enabled: true, ...settings };
  else delete map.cloudShadows;

  const path = resolve(REPO_ROOT, `verify-shots/runtime-qa/_fixtures/cloud-shadows-${enabled ? "on" : "off"}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(project), "utf8");
  return path;
}
