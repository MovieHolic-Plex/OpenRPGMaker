// test/eventCommandAssist.test.ts
// 이벤트 명령 AI Assist — 순수 로직(프롬프트/파싱·검증/자가수정 루프) + UI(fakeDom 최소 렌더).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiCommandKinds,
  buildEventAssistPrompt,
  parseAndValidate,
  resolveAssistScope,
  runEventCommandAssist,
} from "@/ai/eventCommandAssist";
import {
  EVENT_RESOURCE_SLOT_LABELS,
  eventResourceIdSet,
  listEventResourceOptions,
} from "@/ai/eventResourceCatalog";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import type { AiConfig } from "@/ai/llmClient";
import {
  eventAiStagedCommands,
  hasEventAiStagedDraft,
  renderEventAiAssist,
  resetEventAiStagedForTest,
} from "@/editor/panels/eventEditor/aiAssist";
import { isPassable, isPassableLanding } from "@/project/collision";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "https://example.invalid/v1",
  model: "stub-model",
  liteModel: "stub-model",
  apiKey: "sk-test",
  maxToolCalls: 8,
  maxTokens: 2048,
};

function testProject(): Project {
  const project = createBlankProject();
  project.switches[0] = { id: "sw_0001", name: "보물상자 열림" };
  return project;
}

// 기본 타일셋에서 통행 불가로 표시된 타일 하나를 찾는다(하드코딩한 타일 번호는 타일셋이
// 바뀌면 조용히 거짓이 된다).
function findImpassableTile(project: Project, map: Project["maps"][string]): number {
  const probe = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
  for (let tile = 0; tile < 512; tile += 1) {
    probe.lowerTiles[0] = tile;
    probe.upperTiles[0] = tile;
    if (!isPassable(project, probe, 0, 0)) return tile;
  }
  throw new Error("기본 타일셋에서 통행 불가 타일을 찾지 못했습니다");
}

function testPage(commands: Command[] = []): EventPage {
  return {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

// 보물상자 시나리오의 유효한 커맨드 배열(item_potion/sw_0001은 블랭크 프로젝트에 실존).
const CHEST_COMMANDS: Command[] = [
  {
    kind: "fork",
    condition: { kind: "selfSwitch", key: "A", value: true },
    then: [{ kind: "text", body: "비어 있다" }],
    else: [
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
      { kind: "setSelfSwitch", key: "A", value: true },
    ],
  } as Command,
];

// 호출마다 새 Response를 만들어야 한다(Response body는 1회만 읽힘).
function mockFetchSequence(...contents: string[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const mock = vi.fn(async () => {
    const content = contents[Math.min(call++, contents.length - 1)];
    return new Response(
      JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildEventAssistPrompt", () => {
  it("kind 목록·factory 기본값 예시·리소스 id 목록·출력 규약을 포함한다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });

    // kind 목록(레지스트리 파생) + m2Command 제외.
    expect(prompt).toContain("setSelfSwitch");
    expect(prompt).not.toContain('"kind":"m2Command"');
    // newCommand 기본값 자동 직렬화 예시.
    expect(prompt).toContain('{"kind":"changeItem","itemId":"","op":"+=","amount":1}');
    expect(prompt).toContain('runControl action variants: start, advance, end, setFlag, resetRoom');
    expect(prompt).toContain('run condition queries: active, floor, flag, result');
    // 참조 가능한 리소스 id:이름.
    expect(prompt).toContain("item_potion: 회복약");
    expect(prompt).toContain("sw_0001: 보물상자 열림");
    // 출력 규약.
    expect(prompt).toContain("JSON 배열");
  });

  it("AI 저작 표면에서 제외된 명령은 kind 목록과 예시에 노출하지 않는다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });

    expect(prompt).not.toContain('"kind":"m2Command"');
    expect(prompt).not.toContain('"kind":"changeFactionStance"');
    expect(prompt.match(/사용 가능한 kind: ([^\n]+)/u)?.[1]?.split(", ")).not.toContain("changeFactionStance");
  });

  it("resourceId 명령을 쓰게 하되 id 목록을 종류별로 실어 준다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });
    const kinds = prompt.match(/사용 가능한 kind: ([^\n]+)/u)?.[1]?.split(", ") ?? [];

    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of ["playAudio", "showPicture", "changeFace"]) {
      expect(kinds).toContain(kind);
      expect(prompt).toContain(`- ${kind}: `);
    }
    // 종류별 절이 서기고, 각 절에 그 종류의 실제 id 가 보여야 한다.
    for (const slot of ["faceset", "music", "sound", "picture"] as const) {
      const label = EVENT_RESOURCE_SLOT_LABELS[slot];
      expect(prompt).toContain(`### ${label} id`);
      const first = listEventResourceOptions(slot, project)[0]!;
      expect(prompt).toContain(`- ${first.id}:`);
    }
    expect(prompt).toContain("playAudio.resourceId");
  });

  it("칩셋 id 를 오디오·얼굴 칸에 쓸 수 있는 것으로 제시하지 않는다 — 한 덩어리 목록은 없다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });
    const chipsetId = [...collectResourceIds(project)].find((id) => id.startsWith("tex_easyrpg_chipset"))!;

    // 직전 구현은 1851개를 한 절에 실어 앞 40개가 전부 칩셋·아이콘이었다.
    expect(prompt).not.toContain("### 리소스\n");
    for (const slot of ["music", "sound", "faceset", "movie"] as const) {
      expect(eventResourceIdSet(slot, project).has(chipsetId)).toBe(false);
    }
  });

  it("고를 리소스가 없는 kind 는 프로젝트를 보고 목록에서 뺀다 — 동영상", () => {
    const blank = testProject();
    expect(listEventResourceOptions("movie", blank)).toHaveLength(0);
    expect(aiCommandKinds(blank)).not.toContain("playMovie");
    const blankPrompt = buildEventAssistPrompt({ project: blank, mapId: blank.startMapId, page: testPage() });
    expect(blankPrompt.match(/사용 가능한 kind: ([^\n]+)/u)?.[1]?.split(", ")).not.toContain("playMovie");

    const withMovie = testProject();
    withMovie.assets.uploaded["upload-intro-movie"] = {
      id: "upload-intro-movie",
      name: "오픈생 영상",
      kind: "movie",
      dataUrl: "data:video/webm;base64,AA==",
      meta: {},
    };
    expect(aiCommandKinds(withMovie)).toContain("playMovie");
    const moviePrompt = buildEventAssistPrompt({
      project: withMovie,
      mapId: withMovie.startMapId,
      page: testPage(),
    });
    expect(moviePrompt).toContain("### 동영상 id");
    expect(moviePrompt).toContain("- upload-intro-movie:");
  });

  it("맵 목록에 transfer 좌표를 찍을 정확한 크기 문구를 싣는다", () => {
    const project = testProject();
    const map = project.maps[project.startMapId];
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });
    expect(prompt).toContain(`가로 ${map.width} × 세로 ${map.height}`);
  });

  it("기존 페이지 커맨드를 요약에 포함한다", () => {
    const project = testProject();
    const page = testPage([{ kind: "text", body: "안녕하세요" }]);
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page });
    expect(prompt).toContain("안녕하세요");
  });

  it("기본 scope는 page — 고친 뒤 최종 목록 전체를 요구한다", () => {
    const project = testProject();
    const page = testPage([{ kind: "text", body: "안녕하세요" }]);
    expect(resolveAssistScope(page)).toBe("page");
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page });
    expect(prompt).toContain("최종 커맨드 JSON 배열");
    expect(prompt).toContain("바꾸지 않을 기존 커맨드도 그대로 다시 포함");
    expect(prompt).toContain("지울 커맨드는 출력에서 빼고");
  });

  it("페이지가 예산을 넘으면 append로 내려가 «기존을 손대지 말라»고 지시한다", () => {
    const project = testProject();
    const long = testPage(Array.from({ length: 400 }, (_, index) => (
      { kind: "text", body: `대사 ${index} ${"가".repeat(40)}` } as Command
    )));
    expect(resolveAssistScope(long)).toBe("append");
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: long });
    expect(prompt).toContain("뒤에 붙일 새 커맨드 JSON 배열");
    expect(prompt).toContain("기존 명령은 손대지 말고");
    // 잘린 JSON 을 실어 모델이 깨진 목록을 보는 일이 없어야 한다.
    expect(prompt).not.toContain("…(생략)");
  });

  it("선택 위치를 내부 경로 배열로 싣지 않고 사람 말로 싣는다", () => {
    const project = testProject();
    const page = testPage([
      { kind: "text", body: "인사" },
      { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [] } as Command,
    ]);
    const prompt = buildEventAssistPrompt({
      project,
      mapId: project.startMapId,
      page,
      // fork 의 «조건이 맞을 때» 가지 안쪽 — 음수 센티널이 섞인 내부 인코딩.
      selection: [1, -2, 0],
      selectionLabel: "조건 분기",
    });
    expect(prompt).toContain("「조건 분기」");
    expect(prompt).not.toContain("[1,-2,0]");
    expect(prompt).not.toContain("-2");
  });
});

describe("parseAndValidate", () => {
  it("```json 펜스가 있는 유효 배열을 커맨드로 파싱한다", () => {
    const text = "```json\n" + JSON.stringify(CHEST_COMMANDS) + "\n```";
    const result = parseAndValidate(testProject(), text);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(", "));
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].kind).toBe("fork");
  });

  it("AI 저작 표면에서 제외된 명령은 파싱에서도 거부한다", () => {
    const result = parseAndValidate(
      testProject(),
      '[{"kind":"changeFactionStance","a":"guard","b":"player","op":"+=","value":0.25}]',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("AI 저작 표면");
  });

  it("존재하지 않는 itemId는 참조 에러로 거부한다", () => {
    const bad = [{ kind: "changeItem", itemId: "item_ghost", op: "+=", amount: 2 }];
    const result = parseAndValidate(testProject(), JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("참조 에러를 기대했다");
    expect(result.errors.join(" ")).toContain("item_ghost");
  });

  it("맵 밖으로 나가는 transfer 좌표를 거부한다 — 자가수정 루프가 고칠 기회를 준다", () => {
    const project = testProject();
    const map = project.maps[project.startMapId];
    const outside: Command[] = [
      { kind: "transfer", mapId: project.startMapId, x: map.width, y: 0, direction: "retain", fade: "black" } as Command,
    ];
    const result = parseAndValidate(project, JSON.stringify(outside));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("맵 밖 좌표가 통과했습니다");
    expect(result.errors.join(" ")).toContain("transfer");
  });

  it("밟을 수 없는 칸으로 보내는 transfer 를 거부하고 대안 좌표를 알려준다", () => {
    const project = testProject();
    const map = project.maps[project.startMapId];
    const blockedTile = findImpassableTile(project, map);
    const blockedIndex = 0;
    map.lowerTiles[blockedIndex] = blockedTile;
    map.upperTiles[blockedIndex] = blockedTile;

    const blocked: Command[] = [
      { kind: "transfer", mapId: project.startMapId, x: 0, y: 0, direction: "retain", fade: "black" } as Command,
    ];
    const result = parseAndValidate(project, JSON.stringify(blocked));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("밟을 수 없는 칸이 통과했습니다");
    expect(result.errors.join(" ")).toContain("밟을 수 없는 칸");
    expect(result.errors.join(" ")).toMatch(/예: x=\d+ y=\d+/u);
  });

  it("isPassable 만 통과하는 한 방향 함정 칸 transfer 를 거부한다", () => {
    const project = testProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles.fill(306);
    map.upperTiles.fill(-1);
    map.lowerTiles[3 * map.width + 3] = 230;
    map.lowerTiles[5 * map.width + 5] = 240;
    map.lowerTiles[5 * map.width + 4] = 240;

    expect(isPassable(project, map, 3, 3)).toBe(true);
    expect(isPassableLanding(project, map, 3, 3)).toBe(false);
    const result = parseAndValidate(project, JSON.stringify([
      { kind: "transfer", mapId: project.startMapId, x: 3, y: 3, direction: "retain", fade: "black" },
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("한 방향 함정 칸이 통과했습니다");
    expect(result.errors.join(" ")).toContain("밟을 수 없는 칸");
  });

  it("맵 안 transfer 좌표는 통과한다", () => {
    const project = testProject();
    const inside: Command[] = [
      { kind: "transfer", mapId: project.startMapId, x: 1, y: 1, direction: "retain", fade: "black" } as Command,
    ];
    expect(parseAndValidate(project, JSON.stringify(inside)).ok).toBe(true);
  });

  it("종류가 맞는 얼굴·소리·그림 resourceId 는 통과한다", () => {
    const project = testProject();
    const face = listEventResourceOptions("faceset", project)[0]!.id;
    const music = listEventResourceOptions("music", project)[0]!.id;
    const sound = listEventResourceOptions("sound", project)[0]!.id;
    const picture = listEventResourceOptions("picture", project)[0]!.id;

    const result = parseAndValidate(project, JSON.stringify([
      { kind: "changeFace", resourceId: face, position: "left", flipHorizontally: false },
      { kind: "playAudio", resourceId: music, loop: true },
      { kind: "playAudio", resourceId: sound, loop: false },
      { kind: "showPicture", pictureId: "pic1", resourceId: picture, x: 0, y: 0 },
    ]));

    if (!result.ok) throw new Error(result.errors.join(" / "));
    expect(result.commands).toHaveLength(4);
  });

  it("칩셋 id 를 playAudio 에 쓰면 반려하고 쓸 수 있는 id 를 알려준다", () => {
    const project = testProject();
    const chipsetId = [...collectResourceIds(project)].find((id) => id.startsWith("tex_easyrpg_chipset"))!;

    // 전역 집합 소속만 보는 기존 참조 검증은 이걸 통과시킨다 — 그래서 종류 검증이 필요하다.
    expect(collectResourceIds(project).has(chipsetId)).toBe(true);

    const result = parseAndValidate(project, JSON.stringify([
      { kind: "playAudio", resourceId: chipsetId, loop: true },
    ]));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("칩셋 id 가 소리로 통과했습니다");
    const message = result.errors.join(" ");
    expect(message).toContain("playAudio");
    expect(message).toContain(chipsetId);
    expect(message).toContain(EVENT_RESOURCE_SLOT_LABELS.music);
  });

  it("얼굴 칸에 음악 id 를 쓰는 어깃남도 잡고, 번 칸은 「얼굴 지우기」로 통과시킨다", () => {
    const project = testProject();
    const music = listEventResourceOptions("music", project)[0]!.id;

    const mismatched = parseAndValidate(project, JSON.stringify([
      { kind: "changeFace", resourceId: music, position: "left", flipHorizontally: false },
    ]));
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) expect(mismatched.errors.join(" ")).toContain(EVENT_RESOURCE_SLOT_LABELS.faceset);

    const cleared = parseAndValidate(project, JSON.stringify([
      { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
    ]));
    if (!cleared.ok) throw new Error(cleared.errors.join(" / "));
  });

  it("동영상이 없는 프로젝트에서 playMovie 는 어느 id 로도 통과하지 못한다", () => {
    const project = testProject();
    const picture = listEventResourceOptions("picture", project)[0]!.id;
    const result = parseAndValidate(project, JSON.stringify([
      { kind: "playMovie", resourceId: picture, wait: true, skippable: true },
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("동영상이 없는데 playMovie 가 통과했습니다");
    expect(result.errors.join(" ")).toContain(EVENT_RESOURCE_SLOT_LABELS.movie);
  });

  it("흉상·전신 프리셋 id 는 얼굴 절에 보이고 검증을 통과한다 — 폼이 권하는 id 다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });
    // 얼굴 절만 오려낸다 — MAX_REF_ENTRIES 상한 안에 실려 있어야 모델이 보는 것이다.
    const faceSection = prompt.slice(prompt.indexOf(`### ${EVENT_RESOURCE_SLOT_LABELS.faceset} id`)).split("###")[1] ?? "";

    for (const id of ["generated-face-actor1-bust", "generated-face-actor1-full"]) {
      expect(eventResourceIdSet("faceset", project).has(id)).toBe(true);
      expect(faceSection).toContain(id);
      const result = parseAndValidate(project, JSON.stringify([
        { kind: "changeFace", resourceId: id, position: "left", flipHorizontally: false },
      ]));
      if (!result.ok) throw new Error(`${id} 가 반려됐다: ${result.errors.join(" / ")}`);
    }
  });

  it("「그림 선택」 픽커가 제시하는 이미지는 하나도 반려하지 않는다", () => {
    const project = testProject();
    // 폼의 「그림 선택…」 버튼은 kind:"image" 로 이 목록을 열어 준다. 저작 UI 가 권한
    // id 를 검증이 반려하면 자가수정 3회를 헛쓰고 사용자 요구가 하드 실패한다.
    const offered = listDatabaseResourceOptions("image", project);
    expect(offered.length).toBeGreaterThan(400);

    const rejected = offered.filter((option) => !parseAndValidate(project, JSON.stringify([
      { kind: "showPicture", pictureId: "pic1", resourceId: option.id, x: 0, y: 0 },
    ])).ok);
    expect(rejected.map((option) => option.id)).toEqual([]);

    // 지적된 실제 사례: 큼레이심 목록에는 없지만 런타임은 해석하는 아이콘.
    expect(listEventResourceOptions("picture", project).some((o) => o.id === "scarloxy-monster-icon-atrox")).toBe(false);
    const iconResult = parseAndValidate(project, JSON.stringify([
      { kind: "showPicture", pictureId: "pic1", resourceId: "scarloxy-monster-icon-atrox", x: 0, y: 0 },
    ]));
    if (!iconResult.ok) throw new Error(iconResult.errors.join(" / "));
  });

  it("업로드 종류가 monster 여도 그림으로 쓸 수 있고, 오디오 업로드는 그림 칸에서 반려된다", () => {
    const project = testProject();
    project.assets.uploaded["upload-monster-art"] = {
      id: "upload-monster-art",
      name: "업로드 몬스터 그림",
      kind: "monster",
      dataUrl: "data:image/png;base64,AA==",
      meta: {},
    };
    project.assets.uploaded["upload-bgm"] = {
      id: "upload-bgm",
      name: "업로드 음악",
      kind: "music",
      dataUrl: "data:audio/mpeg;base64,AA==",
      meta: {},
    };

    // 픽커는 image 슬롯에 picture|monster|system 업로드를 모두 제시한다.
    const pictureOk = parseAndValidate(project, JSON.stringify([
      { kind: "showPicture", pictureId: "pic1", resourceId: "upload-monster-art", x: 0, y: 0 },
    ]));
    if (!pictureOk.ok) throw new Error(pictureOk.errors.join(" / "));

    // 그러나 오디오를 그림으로 쓰는 종류 교차는 여전히 닫햘 있어야 한다.
    const audioAsPicture = parseAndValidate(project, JSON.stringify([
      { kind: "showPicture", pictureId: "pic1", resourceId: "upload-bgm", x: 0, y: 0 },
    ]));
    expect(audioAsPicture.ok).toBe(false);
    if (!audioAsPicture.ok) expect(audioAsPicture.errors.join(" ")).toContain(EVENT_RESOURCE_SLOT_LABELS.picture);
  });

  it("알 수 없는 kind는 shape 에러로 거부한다", () => {
    const result = parseAndValidate(testProject(), '[{"kind":"summonDragon"}]');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("shape 에러를 기대했다");
    expect(result.errors.join(" ")).toContain("summonDragon");
  });

  it("JSON 배열이 없으면 에러를 돌려준다", () => {
    const result = parseAndValidate(testProject(), "회복약을 드릴게요!");
    expect(result.ok).toBe(false);
  });
});

describe("runEventCommandAssist 자가수정 루프", () => {
  it("보조 모델(liteModel)로 chatCompletion 요청을 만든다", async () => {
    const fetchMock = mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const project = testProject();
    await runEventCommandAssist({
      config: { ...CONFIG, model: "main-model", liteModel: "event-lite-model" },
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });

    const firstBody = (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body;
    expect(JSON.parse(firstBody).model).toBe("event-lite-model");
  });

  it("정상 JSON이면 1회 시도로 커맨드를 돌려준다", async () => {
    const fetchMock = mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const project = testProject();
    const result = await runEventCommandAssist({
      config: CONFIG,
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });
    expect(result.attempts).toBe(1);
    expect(result.commands[0].kind).toBe("fork");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("1회 불량 JSON이면 에러를 되돌려 재시도해 성공한다", async () => {
    const fetchMock = mockFetchSequence(
      "죄송해요, 커맨드는 이렇습니다: 회복약 2개!",
      JSON.stringify(CHEST_COMMANDS)
    );
    const project = testProject();
    const result = await runEventCommandAssist({
      config: CONFIG,
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 2번째 호출의 요청 본문에 검증 에러 피드백이 포함되어야 한다.
    const secondBody = (fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body;
    expect(secondBody).toContain("검증에 실패");
  });

  it("3회 모두 실패하면 마지막 에러로 던진다", async () => {
    mockFetchSequence(
      '[{"kind":"changeItem","itemId":"item_ghost","op":"+=","amount":2}]'
    );
    const project = testProject();
    await expect(
      runEventCommandAssist({
        config: CONFIG,
        prompt: "보물상자",
        context: { project, mapId: project.startMapId, page: testPage() },
      })
    ).rejects.toThrow(/item_ghost/);
  });
});

describe("AI Assist 패널 UI (fakeDom)", () => {
  let restoreFakeDom: () => void = () => undefined;

  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    resetEventAiStagedForTest();
    store.replace(testProject());
  });

  afterEach(() => {
    restoreFakeDom();
  });

  type Harness = {
    readonly panel: FakeElement;
    readonly stagedHost: FakeElement;
    readonly commandCount: FakeElement;
    readonly replaced: Command[][];
    readonly page: EventPage;
    readonly eventId: string;
  };

  function renderPanel(apiKey = "sk-test", page: EventPage = testPage()): Harness {
    return renderPanelFor("event-1", apiKey, page);
  }

  function renderPanelFor(eventId: string, apiKey = "sk-test", page: EventPage = testPage()): Harness {
    const cmdList = new FakeElement("div") as unknown as HTMLElement;
    const stagedHost = new FakeElement("div");
    const commandCount = new FakeElement("span");
    const replaced: Command[][] = [];
    const mapId = store.getCurrent().startMapId;
    store.getCurrent().maps[mapId].events = [{
      id: eventId,
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: structuredClone(page.commands),
      pages: [structuredClone(page)],
    }];
    const refreshCommandCount = (): void => {
      const stagedCommands = eventAiStagedCommands(mapId, eventId, page.id);
      commandCount.textContent = `${(stagedCommands ?? page.commands).length}개`;
    };
    refreshCommandCount();
    const panel = renderEventAiAssist({
      mapId,
      eventId,
      page,
      cmdList,
      stagedHost: stagedHost as unknown as HTMLElement,
      refreshListVisibility: refreshCommandCount,
      replaceAll: (commands) => void replaced.push(structuredClone(commands) as Command[]),
      loadConfig: () => ({ ...CONFIG, apiKey }),
    }) as unknown as FakeElement;
    return { panel, stagedHost, commandCount, replaced, page, eventId };
  }

  async function generate(harness: Harness, prompt: string): Promise<void> {
    findByTestId(harness.panel, "ai-event-input")!.value = prompt;
    findByTestId(harness.panel, "ai-event-generate")!.click();
    await vi.waitFor(() => expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(false));
  }

  function deferredFetch(): { resolve: (content: string) => void; mock: ReturnType<typeof vi.fn> } {
    let resolveResponse!: (response: Response) => void;
    const mock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    (globalThis as unknown as { fetch: unknown }).fetch = mock;
    return {
      mock,
      resolve: (content) => resolveResponse(new Response(
        JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )),
    };
  }

  it("같은 ids를 가진 다른 프로젝트로 바꾸면 초안과 열린 상태를 공유하지 않는다", () => {
    const panelA = renderPanelFor("shared-event").panel;
    const inputA = findByTestId(panelA, "ai-event-input")!;
    inputA.value = "Project A private draft";
    inputA.dispatchEvent(new Event("input"));
    (panelA as unknown as HTMLDetailsElement).open = true;
    panelA.dispatchEvent(new Event("toggle"));

    const projectB = createBlankProject();
    store.replaceProject(projectB);
    const panelB = renderPanelFor("shared-event").panel;

    expect(findByTestId(panelB, "ai-event-input")!.value).toBe("");
    expect((panelB as unknown as HTMLDetailsElement).open).toBe(false);
  });

  it("프롬프트 입력과 생성 상태, 결과 영역을 보이는 레이블로 연결한다", () => {
    const { panel } = renderPanel();

    const input = findByTestId(panel, "ai-event-input")!;
    const promptLabel = findByTestId(panel, "ai-event-prompt-label")!;
    const status = findByTestId(panel, "ai-event-status")!;
    const result = findByTestId(panel, "ai-event-result")!;
    const resultTitle = findByTestId(panel, "ai-event-result-title")!;

    expect(promptLabel.tagName).toBe("LABEL");
    expect(promptLabel.getAttribute("for")).toBe(input.getAttribute("id"));
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(result.getAttribute("role")).toBe("region");
    expect(result.getAttribute("aria-labelledby")).toBe(resultTitle.getAttribute("id"));
    expect(result.hidden).toBe(true);
  });

  it("초안은 도크 카드가 아니라 목록 자리(stagedHost)에 유령 행으로 그려진다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    expect(findByTestId(harness.panel, "ai-event-assist")).not.toBeNull();

    await generate(harness, "보물상자: 열면 회복약 2개");

    const staged = findByTestId(harness.stagedHost, "ai-event-staged")!;
    expect(staged.textContent).toContain("조건 분기");
    expect(staged.textContent).toContain("비어 있다");
    // 새로 생기는 행은 add 로 표시된다.
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-add")).not.toBeNull();
    // 초안이 있는 동안 content.ts 는 목록 대신 초안을 보여야 한다.
    expect(hasEventAiStagedDraft(store.getCurrent().startMapId, "event-1", "page-1")).toBe(true);
  });

  it("적용은 목록 전체 교체 한 번이다 — 되돌리기 스냅샷이 한 칸만 쌓인다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    await generate(harness, "보물상자");

    findByTestId(harness.panel, "ai-event-apply")!.click();

    // 명령 3개를 만들었어도 replaceAll 은 딱 한 번(예전에는 insertCommand 를 개수만큼 불렀다).
    expect(harness.replaced).toHaveLength(1);
    expect(harness.replaced[0]).toHaveLength(1);
    expect(harness.replaced[0][0].kind).toBe("fork");
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.panel.textContent).toContain("↶ 되돌리기 한 번");
  });

  it("기존 명령이 있는 페이지에서 «고쳐 달라»고 하면 덧붙이지 않고 바뀜으로 표시한다", async () => {
    // 모델이 최종 목록을 돌려준다: 대사 문구만 달라졌다.
    mockFetchSequence(JSON.stringify([{ kind: "text", body: "낡은 상자다" }]));
    const page = testPage([{ kind: "text", body: "상자다" }]);
    const harness = renderPanel("sk-test", page);

    await generate(harness, "대사를 «낡은 상자다»로 고쳐 줘");

    // 예전 계약(삽입)이면 명령이 2개가 됐다. 이제는 1개가 «바뀜» 으로 표시된다.
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-change")).not.toBeNull();
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-add")).toBeNull();

    findByTestId(harness.panel, "ai-event-apply")!.click();
    expect(harness.replaced[0]).toHaveLength(1);
    expect(harness.replaced[0][0]).toMatchObject({ kind: "text", body: "낡은 상자다" });
  });

  it("행마다 «이건 빼기»로 골라 적용할 수 있다", async () => {
    mockFetchSequence(JSON.stringify([
      { kind: "text", body: "안녕" },
      { kind: "text", body: "새 대사" },
    ]));
    const page = testPage([{ kind: "text", body: "안녕" }]);
    const harness = renderPanel("sk-test", page);

    await generate(harness, "대사 한 줄 더 붙여 줘");
    const addRow = findByTestId(harness.stagedHost, "ai-event-staged-row-add")!;
    const toggle = findByTestId(addRow, `ai-event-staged-toggle-${addRow.dataset.stagedId}`)!;
    toggle.click();

    // 전부 뺐으므로 적용할 것이 없다.
    expect(findByTestId(harness.panel, "ai-event-result-meta")!.textContent).toContain("모두 뺐어요");
    expect((findByTestId(harness.panel, "ai-event-apply") as unknown as HTMLButtonElement).disabled).toBe(true);
  });

  it("생성 중 명령 목록이 바뀌면 초안을 만들거나 적용하지 않는다", async () => {
    const pending = deferredFetch();
    const page = testPage([{ kind: "text", body: "처음 대사" }]);
    const harness = renderPanel("sk-test", page);
    const input = findByTestId(harness.panel, "ai-event-input")!;
    input.value = "대사를 고쳐 줘";
    findByTestId(harness.panel, "ai-event-generate")!.click();
    await vi.waitFor(() => expect(pending.mock).toHaveBeenCalledTimes(1));

    const livePage = store.getCurrent().maps[store.getCurrent().startMapId].events[0]!.pages![0]!;
    livePage.commands.push({ kind: "text", body: "사용자가 생성 중 추가한 대사" });
    pending.resolve(JSON.stringify([{ kind: "text", body: "AI가 고친 대사" }]));

    await vi.waitFor(() => expect(harness.panel.textContent).toContain("명령 목록이 생성 중에 바뀌었어요"));
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(hasEventAiStagedDraft(store.getCurrent().startMapId, harness.eventId, page.id)).toBe(false);
    expect(harness.replaced).toHaveLength(0);
    findByTestId(harness.panel, "ai-event-apply")!.click();
    expect(harness.replaced).toHaveLength(0);
  });

  it("생성 중 재렌더된 뒤에도 살아 있는 도크의 생성 버튼이 다시 활성된다", async () => {
    const pending = deferredFetch();
    const page = testPage([{ kind: "text", body: "처음 대사" }]);
    const first = renderPanel("sk-test", page);
    findByTestId(first.panel, "ai-event-input")!.value = "대사를 고쳐 줘";
    findByTestId(first.panel, "ai-event-generate")!.click();
    await vi.waitFor(() => expect(pending.mock).toHaveBeenCalledTimes(1));

    // 생성 중 스토어 갱신 → content.ts 가 본문을 다시 그린다. 이전 도크는 문서에서 떨어진다.
    const live = renderPanel("sk-test", page);
    const liveGenerate = findByTestId(live.panel, "ai-event-generate") as unknown as HTMLButtonElement;
    // 새 도크는 busy 상태를 이어받아 잠개 있어야 한다(같은 원으로 둘째 호출 금지).
    expect(liveGenerate.disabled).toBe(true);

    pending.resolve(JSON.stringify([{ kind: "text", body: "AI가 고친 대사" }]));
    await vi.waitFor(() => expect(findByTestId(live.panel, "ai-event-result")!.hidden).toBe(false));

    // 예전에는 finally 가 분리된 옛 도크의 버튼만 풀어서 사용자가 재생성을 영구히 릻혔다.
    expect(liveGenerate.disabled).toBe(false);

    // 잠긴 것이 아니라 진짜로 다시 생성할 수 있어야 한다.
    const second = deferredFetch();
    findByTestId(live.panel, "ai-event-input")!.value = "한 번 더 고쳐 줘";
    liveGenerate.click();
    await vi.waitFor(() => expect(second.mock).toHaveBeenCalledTimes(1));
    second.resolve(JSON.stringify([{ kind: "text", body: "다시 고친 대사" }]));
    await vi.waitFor(() => expect(liveGenerate.disabled).toBe(false));
  });

  it("surviving staged rows use the applied result sequence for numbers and the badge", async () => {
    // before=[A,B] / after=[B] is deliberately remove+keep. Raw diff indexing labels B as 2,
    // but the applied result contains one command, so both row and badge must say 1.
    mockFetchSequence(JSON.stringify([{ kind: "text", body: "B" }]));
    const page = testPage([{ kind: "text", body: "A" }, { kind: "text", body: "B" }]);
    const harness = renderPanel("sk-test", page);

    await generate(harness, "첫 대사를 지워 줘");

    const remove = findByTestId(harness.stagedHost, "ai-event-staged-row-remove")!;
    const keep = findByTestId(harness.stagedHost, "ai-event-staged-row-keep")!;
    expect(remove.querySelector(".cmd-step")).toBeNull();
    expect(keep.querySelector(".cmd-step")?.textContent).toBe("1");
    expect(harness.commandCount.textContent).toBe("1개");
  });

  it("excluding an add row rerenders the remaining staged numbers contiguously", async () => {
    mockFetchSequence(JSON.stringify([
      { kind: "text", body: "A" },
      { kind: "text", body: "new" },
      { kind: "wait", ms: 500 },
    ]));
    const harness = renderPanel("sk-test", testPage([{ kind: "text", body: "A" }]));

    await generate(harness, "두 명령을 더해 줘");
    let steps = (harness.stagedHost.querySelectorAll(".cmd-step") as unknown as FakeElement[])
      .map((node) => node.textContent);
    expect(steps).toEqual(["1", "2", "3"]);

    const firstAdd = findByTestId(harness.stagedHost, "ai-event-staged-row-add")!;
    findByTestId(firstAdd, `ai-event-staged-toggle-${firstAdd.dataset.stagedId}`)!.click();

    steps = (harness.stagedHost.querySelectorAll(".cmd-step") as unknown as FakeElement[])
      .map((node) => node.textContent);
    const excludedAdd = findByTestId(harness.stagedHost, "ai-event-staged-row-add")!;
    expect(excludedAdd.querySelector(".cmd-step")).toBeNull();
    expect(steps).toEqual(["1", "2"]);
    expect(harness.commandCount.textContent).toBe("2개");
  });

  it("취소를 누르면 초안만 지우고 목록을 건드리지 않는다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    await generate(harness, "보물상자");

    findByTestId(harness.panel, "ai-event-discard")!.click();
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.replaced).toHaveLength(0);
    expect(hasEventAiStagedDraft(store.getCurrent().startMapId, "event-1", "page-1")).toBe(false);
  });

  it("연결이 안 됐으면 연결 방식을 완료하라고 안내한다", () => {
    const { panel } = renderPanel("");
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    // 옛 문구는 "API 키와 baseUrl을 입력하세요" 였다 — 그 두 입력은 설정 모달에서 걷었고
    // 자격은 동반 서비스가 보관한다. 없는 입력을 가리키는 안내를 남기지 않는다.
    expect(panel.textContent).toContain("연결 방식");
    expect(panel.textContent).not.toContain("baseUrl");
  });

  it("ChatGPT 모드(apiKey 없음)에서는 생성을 막지 않고 초안을 보여준다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const cmdList = new FakeElement("div") as unknown as HTMLElement;
    const stagedHost = new FakeElement("div");
    const mapId = store.getCurrent().startMapId;
    const page = testPage();
    store.getCurrent().maps[mapId].events = [{
      id: "event-1",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: structuredClone(page.commands),
      pages: [structuredClone(page)],
    }];
    const panel = renderEventAiAssist({
      mapId,
      eventId: "event-1",
      page,
      cmdList,
      stagedHost: stagedHost as unknown as HTMLElement,
      refreshListVisibility: () => undefined,
      replaceAll: () => undefined,
      loadConfig: () => ({ ...CONFIG, authMode: "chatgpt", apiKey: "", baseUrl: "/v1" }),
    }) as unknown as FakeElement;
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    await vi.waitFor(() => {
      expect(findByTestId(panel, "ai-event-result")!.hidden).toBe(false);
      expect(stagedHost.textContent).toContain("조건 분기");
    });
    expect(panel.textContent).not.toContain("API 키");
    // 후속 테스트가 동일 panelState 키를 공유하므로 초안을 정리한다.
    findByTestId(panel, "ai-event-discard")!.click();
  });

  it("존재하지 않는 itemId만 계속 돌아오면 에러를 표시한다", async () => {
    mockFetchSequence(
      '[{"kind":"changeItem","itemId":"item_ghost","op":"+=","amount":2}]'
    );
    const harness = renderPanel();
    findByTestId(harness.panel, "ai-event-input")!.value = "유령 아이템";
    findByTestId(harness.panel, "ai-event-generate")!.click();

    await vi.waitFor(() => expect(harness.panel.textContent).toContain("item_ghost"));
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.replaced).toHaveLength(0);
  });
});
