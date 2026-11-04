/**
 * 조사 기물 — 「책장·우물·간판·동상·궤짝·무덤·창문 같은 걸 누르면 세계 이야기 한 줄」(사용자 2026-11-04, 월드 정비 2차).
 * 지역마다 5~10개. 기물 칸(막힌 칸)에 투명 읽기 이벤트(action, same)를 새로 단다 — 기존 대사 파일은 건드리지 않는다
 * (대사 다듬기는 fs2-dialogue-r2 가 맡는다). 그 칸에 이미 이벤트가 있거나 걸을 수 있는 칸이면 굽기를 멈춘다.
 * 좌표는 굽기 산출물(play.json)의 tileMeta 라벨 + isPassable 로 고른 칸이다(world-round2.md 표).
 */
import { isPassable } from "@/project/collision";
import type { Project } from "@/project/types";
import { mustMap, narrate, page, putEvent } from "./common";

export type Examine = { readonly mapId: string; readonly x: number; readonly y: number; readonly name: string; readonly lines: readonly string[] };

export const FALLEN_EXAMINES: readonly Examine[] = [
  { mapId: "fs_hub", x: 16, y: 11, name: "물레방아", lines: ["운하 물을 받아 도는 물레방아다.\n삐걱이는 소리가 종소리보다 먼저 아침을 연다."] },
  { mapId: "fs_hub", x: 21, y: 17, name: "놋쇠 망원경", lines: ["광장에 세워 둔 놋쇠 망원경.\n「별지기 조합 기증 — 하늘은 누구의 것도 아니다」"] },
  { mapId: "fs_hub", x: 42, y: 19, name: "말 물통", lines: ["말 물통에 별 그림자가 비친다.\n아이들은 여기에 동전을 던지며 소원을 빈다."] },
  { mapId: "fs_hub", x: 53, y: 19, name: "통행세 초소", lines: ["통행세 초소. 판자에 세금표가 붙어 있다.\n「소금 한 짐 3G, 별가루 한 줌 50G」"] },
  { mapId: "fs_hub", x: 29, y: 35, name: "선원 궤짝", lines: ["뱃사람의 궤짝이다. 뚜껑에 칼로 새긴 글.\n「북쪽 바다 얼음이 녹으면 돌아온다」"] },
  { mapId: "fs_hub", x: 47, y: 29, name: "생선 상자", lines: ["얼음 위에 은빛 생선이 누워 있다.\n서리나루에서 사흘 걸려 온 것이라 한다."] },
  { mapId: "fs_inn", x: 1, y: 5, name: "여관 화덕", lines: ["불씨가 꺼진 적 없는 화덕.\n여관 주인 말로는 할머니 대부터 이어 온 불이다."] },
  { mapId: "fs_inn", x: 3, y: 17, name: "술통 선반", lines: ["술통마다 분필로 날짜가 적혀 있다.\n가장 오래된 통에는 「별이 떨어진 해」라고만 쓰여 있다."] },
  { mapId: "fs_inn", x: 18, y: 17, name: "손님 궤짝", lines: ["여행자가 맡긴 궤짝이다. 꼬리표에 이름 대신\n작은 종 그림이 그려져 있다."] },
  { mapId: "fs_apothecary", x: 9, y: 2, name: "약방 창", lines: ["창틀에 말린 약초가 줄지어 매달려 있다.\n볕이 드는 쪽은 해독초, 그늘 쪽은 잠풀."] },
  { mapId: "fs_stargazer_home", x: 13, y: 3, name: "별지기 책장", lines: ["『별의 길 백 년 기록』이 꽂혀 있다.\n마지막 장은 비어 있고, 누군가 「곧」이라고만 적었다."] },
  { mapId: "fs_stargazer_home", x: 10, y: 2, name: "벽 지도", lines: ["왕국 지도 위에 별자리가 겹쳐 그려져 있다.\n북쪽 고개 위에만 붉은 점이 찍혀 있다."] },
  { mapId: "fs_stargazer_home", x: 5, y: 3, name: "벽난로", lines: ["재 속에 타다 만 종이가 있다.\n「종이 세 번 울리면」까지만 읽힌다."] },
  { mapId: "fs_lisa_home", x: 1, y: 11, name: "괘종시계", lines: ["멈춘 괘종시계. 바늘이 자정 직전에 서 있다.\n리사네는 일부러 태엽을 감지 않는다고 한다."] },
  { mapId: "fs_lisa_home", x: 3, y: 14, name: "액자", lines: ["낡은 가족 초상화. 맨 끝 사람의 얼굴만\n별빛에 바랜 것처럼 하얗게 지워져 있다."] },
  { mapId: "fs_bakery_home", x: 3, y: 3, name: "빵 화덕", lines: ["화덕 벽돌에 손자국이 찍혀 있다.\n토마네 빵집 삼대가 하나씩 남긴 것이다."] },
  { mapId: "fs_bakery_home", x: 19, y: 4, name: "사과 통", lines: ["북쪽 과수원 사과다. 올해는 서리가 일러\n알이 작다고 토마가 투덜댔다."] },
  { mapId: "fs_smithy", x: 19, y: 5, name: "담금질 통", lines: ["담금질 물이 검게 빛난다.\n로한은 이 물에 별가루를 한 꼬집 넣는다고 했다."] },
  { mapId: "fs_smithy", x: 6, y: 6, name: "창꽂이", lines: ["수비대에 납품할 창이다. 자루마다\n왕국 문장 대신 작은 별이 새겨져 있다."] },
  { mapId: "fs_forest_edge", x: 19, y: 33, name: "길가 표지 십자", lines: ["길 잃은 나그네를 위한 표지다.\n「바람이 속삭이면 멈춰 서라. 숲이 길을 바꾼다」"] },
  { mapId: "fs_forest", x: 19, y: 7, name: "그루터기", lines: ["벼락 맞은 그루터기. 나이테 한가운데가\n별 모양으로 까맣게 타 있다."] },
  { mapId: "fs_forest_stream", x: 15, y: 13, name: "쓰러진 통나무", lines: ["통나무 아래로 시냇물이 흐른다.\n이끼 사이에 누군가 놓고 간 은 단추 하나."] },
  { mapId: "fs_forest_glade", x: 19, y: 10, name: "쓰러진 통나무", lines: ["사냥꾼들이 쉬어 가는 통나무다.\n칼자국으로 센 늑대 수가 해마다 늘었다."] },
  { mapId: "fs_forest_shrine", x: 26, y: 11, name: "길가 사당", lines: ["작은 사당 안에 돌 종이 놓여 있다.\n종을 두드려도 소리가 나지 않는다."] },
  { mapId: "fs_forest_shrine", x: 13, y: 16, name: "부러진 신전 기둥", lines: ["옛 신전의 기둥이다. 깨진 면에\n「하늘에서 온 것은 하늘로 돌아간다」는 글이 남아 있다."] },
  { mapId: "fs_forest_shrine", x: 18, y: 19, name: "쓰러진 신전 기둥", lines: ["기둥에 별자리가 새겨져 있다.\n그중 하나가 칼로 긁혀 지워져 있다."] },
  { mapId: "map_snow_north_1", x: 14, y: 25, name: "덮개 씌운 짐수레", lines: ["눈에 반쯤 묻힌 짐수레. 덮개 밑에\n얼어붙은 소금 자루가 가득하다. 주인은 보이지 않는다."] },
  { mapId: "map_snow_north_2", x: 20, y: 25, name: "부러진 돌 기둥", lines: ["옛 국경 표지다. 이 너머는 한때\n별의 땅이라 불렸다고 한다."] },
  { mapId: "map_snow_north_2", x: 22, y: 24, name: "돌 기둥", lines: ["돌 기둥에 서리가 꽃처럼 피었다.\n손을 대자 희미하게 따뜻하다."] },
  { mapId: "map_snow_north_2", x: 7, y: 32, name: "바위", lines: ["바위 그늘에 모닥불 자국이 있다.\n재가 아직 식지 않았다. 누군가 앞서 갔다."] },
  { mapId: "map_snow_north_2", x: 10, y: 37, name: "바위", lines: ["바위에 화살표가 새겨져 있다.\n「얼음 호수 — 밤에 건너지 마라」"] },
];

export function placeExamines(project: Project, examines: readonly Examine[] = FALLEN_EXAMINES): void {
  examines.forEach((e, i) => {
    const map = mustMap(project, e.mapId);
    if (map.events.some((ev) => ev.x === e.x && ev.y === e.y)) throw new Error(`[fallen-world] 조사 ${e.name} (${e.mapId} ${e.x},${e.y}) 칸에 이미 이벤트가 있다`);
    if (isPassable(project, map, e.x, e.y)) throw new Error(`[fallen-world] 조사 ${e.name} (${e.mapId} ${e.x},${e.y}) 가 걸을 수 있는 칸이다 — 기물 칸이 아니다`);
    const id = `ev_fs_examine_${e.mapId}_${i}`;
    putEvent(map, id, `조사 · ${e.name}`, { x: e.x, y: e.y }, [page(`${id}_p`, "살핀다", [], e.lines.map((l) => narrate(l)))]);
  });
}
