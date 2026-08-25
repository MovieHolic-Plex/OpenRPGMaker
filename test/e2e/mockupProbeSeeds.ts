// new-editor/mockup/event-editor-mockup.html 과 1:1 로 대응하는 목표화면 시드.
// 목업의 블록 캔버스(최상위 8 + 분기 4 = 명령 12개, 마커 3 = 15행), 레일(페이지 3개,
// 조건 0/2/1), 인스펙터(그림 번호 1 선택) 상태를 재현한다.
// - emptyEventProject(): 빈 이벤트 캔버스(빈스펙터 빈 상태) 검증용 최소 프로젝트.
import { createBlankProject, DEFAULT_ITEM_ID } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

// 빈 이벤트 캔버스 컨버스(인스펙터 빈 상태) 검증용 최소 프로젝트.
export function emptyEventProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  const startMapId = project.startMapId;
  if (!startMapId) throw new Error("blank project has no startMapId");
  const start = project.maps[startMapId];
  if (!start) throw new Error("start map missing");
  const emptyMap = structuredClone(start);
  emptyMap.id = "map_empty";
  emptyMap.name = "빈 이벤트";
  emptyMap.events = [];
  project.maps[emptyMap.id] = emptyMap;
  if (project.mapTree) {
    project.mapTree.children.push({ mapId: emptyMap.id, children: [] });
  } else {
    project.mapTree = { mapId: start.id, children: [{ mapId: emptyMap.id, children: [] }] };
  }

  const event: GameEvent = {
    id: "0001",
    name: "빈 이벤트",
    x: 4,
    y: 4,
    trigger: { kind: "action" },
    commands: [],
    characterId: "north-gate-guard",
    pages: [
      {
        id: "p1",
        name: "빈 페이지",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 2, frequency: 3 },
        commands: [],
      },
    ],
  };
  start.events = [event];
  return { project, eventId: event.id };
}

// 목업 정본과 동일한 모양의 데모 이벤트.
// - 페이지 1 의뢰 제안(조건 없음): 선택지 "나중에" 분기 무진행 + 그림 번호 1 중복 -> 경고 2
//   (탭 배지는 보이지 않는 페이지 경고 대신 무진행만 세도록 overlapForbidden=false)
// - 페이지 2 진행 중(스위치 0001 + 변수>=1): 보이지 않는 그래픽 -> 경고 1
// - 페이지 3 완료 후(스위치 0002): 명령 12개/15행, 보이지 않는 충돌 경고
export function mockupProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  project.switches = [
    { id: "0001", name: "의뢰 수락" },
    { id: "0002", name: "의뢰 완료" },
  ];
  project.variables = [{ id: "0001", name: "처치 수" }];
  project.characters = { "north-gate-guard": { displayName: "북문 경비병" } };
  project.resourceProfiles = [
    ...project.resourceProfiles,
    { kind: "picture", name: "pic_demo", assetId: "easyrpg-picture-cloud", imageWidth: 100, imageHeight: 100 },
  ];

  const startMapId = project.startMapId;
  if (!startMapId) throw new Error("blank project has no startMapId");
  const start = project.maps[startMapId];
  if (!start) throw new Error("start map missing");
  const emptyMap = structuredClone(start);
  emptyMap.id = "map_empty";
  emptyMap.name = "빈 맵";
  emptyMap.events = [];
  project.maps[emptyMap.id] = emptyMap;
  if (project.mapTree) {
    project.mapTree.children.push({ mapId: emptyMap.id, children: [] });
  } else {
    project.mapTree = { mapId: start.id, children: [{ mapId: emptyMap.id, children: [] }] };
  }

  const event: GameEvent = {
    id: "0001",
    name: "완료 후",
    x: 8,
    y: 8,
    trigger: { kind: "action" },
    commands: [],
    characterId: "north-gate-guard",
    pages: [page1(), page2(), page3()],
  };
  start.events = [event];
  return { project, eventId: event.id };
}

// 페이지 1 — 의뢰 제안 · 조건 없음.
function page1(): EventPage {
  const say = (body: string): Command => ({ kind: "text", speaker: undefined, body });
  return {
    id: "p1",
    name: "의뢰 제안",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      say("서쪽길 슬라임과 동쪽길 박쥐떼 때문에 상인들이 발이 묶였어."),
      {
        kind: "choices",
        prompt: "두 길목을 정리해 줄래?",
        options: [
          {
            text: "맡는다",
            branch: [
              { kind: "setSwitch", switchId: "0001", value: true },
              say("좋아. 서쪽과 동쪽 길목을 확인하고 돌아와."),
            ],
          },
          { text: "나중에", branch: [say("시장 사람들은 여기서 기다릴게.")] },
        ],
        cancelBehavior: "choice2",
      },
      { kind: "showPicture", pictureId: "1", resourceId: "easyrpg-picture-cloud", x: 24, y: 32 },
      { kind: "showPicture", pictureId: "1", resourceId: "easyrpg-picture-cloud", x: 60, y: 40 },
    ],
  };
}

// 페이지 2 — 진행 중(스위치 0001 + 변수 0001 >= 1). 보이지 않는 그래픽 -> 경고 1.
function page2(): EventPage {
  return {
    id: "p2",
    name: "진행 중",
    conditions: [
      { kind: "switch", switchId: "0001", value: true },
      { kind: "variable", variableId: "0001", op: ">=", value: 1 },
    ],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      { kind: "text", speaker: undefined, body: "아직 슬라임이 남아 있어. 두 길 모두 치워 줘." },
    ],
  };
}

// 페이지 3 — 완료 후(스위치 0002). 명령 12개(분기 4 포함) = 15행.
function page3(): EventPage {
  const say = (body: string): Command => ({ kind: "text", speaker: "북문 경비병", body });
  const commands: Command[] = [
    say("드디어 돌아왔군. 의뢰는 잘 해결했나?"),
    {
      kind: "choices",
      prompt: "의뢰를 어떻게 마무리하시겠습니까?",
      options: [
        {
          text: "맡는다",
          branch: [
            { kind: "setSwitch", switchId: "0001", value: true },
            { kind: "setVariable", variableId: "0001", op: "=", value: 0 },
            say("고맙네. 자네 덕분이야!"),
          ],
        },
        { text: "나중에", branch: [say("알겠네. 준비되면 다시 말해 주게.")] },
      ],
      cancelBehavior: "choice2",
    },
    { kind: "showPicture", pictureId: "1", resourceId: "easyrpg-picture-cloud", x: 24, y: 32 },
    { kind: "playAudio", resourceId: "cc0-bgm-rtp-twn-001", loop: false },
    { kind: "transfer", mapId: "map_empty", x: 7, y: 10, direction: "down" },
    { kind: "changeGold", op: "+=", amount: 120 },
    { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 2 },
    { kind: "setWeather", weather: "rain", intensity: 0.6 },
  ];
  return {
    id: "p3",
    name: "완료 후",
    conditions: [{ kind: "switch", switchId: "0002", value: true }],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 0 },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
