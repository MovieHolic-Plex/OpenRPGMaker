import assert from "node:assert/strict";

// Recorded model outputs, real browser panel/session/tools/store/persistence.
// The caller supplies a fresh isolated project in an already mounted editor.
export async function replayAudit(page) {
  const mapA = await page.evaluate(() => window.__oprnEditorStore.getCurrent().startMapId);
  const mapB = "map_audit_cave";
  const npcId = "npc_audit_guide";
  const lines = ["오른쪽 길을 따라가면 동굴이 나옵니다.", "준비를 마치고 출발하세요."];
  const graphic = { textureKey: "tex_easyrpg_charset_actor1", characterIndex: 0 };
  const baseNpc = { mapId: mapA, id: npcId, name: "감사 가이드", x: 8, y: 6, graphic };
  const firstPage = {
    commands: [{ kind: "text", body: lines.join("\n") }, { kind: "setSelfSwitch", key: "A", value: true }],
  };
  const secondPage = { lines: ["다시 만나 반갑습니다."], conditions: [{ kind: "selfSwitch", key: "A", value: true }] };
  const call = (name, args = {}) => ({ name, args: { ...args, reason: "첨부 감사 로그의 회귀 경로를 재현합니다." } });
  const readMap = (mapId) => call("get_map_region", { mapId, x: 0, y: 0, w: 20, h: 15 });
  const plan = {
    action: "new_plan", goal: "두 맵의 명세와 오류 복구 회귀 검증",
    acceptance: [
      { id: "maps", title: "두 맵 생성", criteria: [{ kind: "mapCount", targets: [{ mapId: mapA }, { mapId: mapB }], count: 2 }] },
      { id: "terrain", title: "마을 지형 변경", criteria: [{ kind: "targetChange", target: { mapId: mapA }, region: { x: 0, y: 0, w: 20, h: 15 } }] },
      { id: "npc", title: "가이드 배치", criteria: [{ kind: "eventCount", target: { mapId: mapA }, region: { x: 8, y: 6, w: 1, h: 1 }, count: 1 }] },
    ],
    layers: [
      { title: "지형", items: [
        { title: "두 맵 준비와 시공", instruction: "두 맵을 준비하고 두 맵 모두 지형을 칠한다", successTools: ["create_map", "fill_region", "paint_road"] },
      ] },
      { title: "이벤트", items: [{ title: "가이드 배치", instruction: "상태별 가이드를 배치한다", successTools: ["place_npc"] }] },
    ],
  };
  const rounds = [
    [call("get_project_summary"), readMap(mapA), call("find_events", { mapId: mapA })],
    [call("create_map", { id: mapB, name: "감사 동굴", width: 20, height: 15 })],
    [readMap(mapB), call("find_events", { mapId: mapB })],
    [
      call("set_build_spec", { mapId: mapA, assets: [{ id: "invalid", kind: "terrain", x: 0, y: 0, w: 40, h: 15 }] }),
      call("place_props", { mapId: mapA, material: "침엽수", count: 1, area: { x: 2, y: 10, w: 4, h: 4 } }),
      call("complete_work_item"),
    ],
    [
      call("set_build_spec", { mapId: mapA, title: "마을 명세", buildOrder: ["terrain", "road"], assets: [
        { id: "ground", kind: "terrain", layer: "lower", x: 0, y: 0, w: 20, h: 15, overExisting: "clear" },
        { id: "road", kind: "road", layer: "lower", x: 1, y: 6, w: 18, h: 3, overExisting: "clear" },
      ] }),
      call("set_build_spec", { mapId: mapB, title: "동굴 명세", assets: [{ id: "ground", kind: "terrain", x: 1, y: 1, w: 4, h: 4 }] }),
    ],
    [
      call("fill_region", { mapId: mapA, rect: { x: 0, y: 0, w: 20, h: 15 }, material: "모래", layer: "lower", shape: "rect" }),
      call("paint_road", { mapId: mapA, points: [{ x: 1, y: 7 }, { x: 18, y: 7 }], style: "dirt", naturalness: 0 }),
    ],
    [call("fill_region", { mapId: mapB, rect: { x: 1, y: 1, w: 4, h: 4 }, material: "모래", layer: "lower", shape: "rect" })],
    [call("place_npc", { ...baseNpc, dialogue: { text: lines.join("\n") } })],
    [call("place_npc", { ...baseNpc, pages: [{ commands: [{ commandId: "m2-101-show-text", fields: { lines } }] }] })],
    [call("place_npc", { ...baseNpc, pages: [firstPage, { ...secondPage, conditions: { selfSwitch: "A" } }] })],
    [call("place_npc", { ...baseNpc, pages: [firstPage, secondPage] })],
    [call("complete_work_item")],
  ];
  let round = 0;
  const requests = [];
  const handler = async (route) => {
    const body = route.request().postDataJSON();
    let message;
    if (!(body.tools?.length)) {
      message = { role: "assistant", content: JSON.stringify({
        mode: "modify", space: "outdoor", targetMapId: mapA, needsPlan: true,
        readBeforeWrite: { project: true, collections: [], references: false },
        tools: ["get_project_summary", "get_map_region", "find_events", "create_map", "fill_region", "paint_road", "place_npc"],
        summary: "기록된 두 맵 감사 회귀", ...plan,
      }) };
    } else {
      const index = round++;
      const batch = rounds[index];
      requests.push({ index, names: batch?.map((entry) => entry.name) ?? [] });
      message = batch ? {
        role: "assistant", content: null,
        tool_calls: batch.map((entry, i) => ({
          id: `audit_${index}_${i}`, type: "function",
          function: { name: entry.name, arguments: JSON.stringify(entry.args) },
        })),
      } : { role: "assistant", content: "감사 회귀 시나리오를 완료했습니다." };
    }
    await route.fulfill({ json: { choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] } });
  };
  await page.route("**/v1/chat/completions", handler);
  let result;
  try {
    result = await page.evaluate(text => window.__oprnAiBridge.send(text),
      "기록된 모델 응답을 재생하는 QA입니다. 두 맵을 준비하고, 거절된 명세의 후속 소품/완료는 실행하지 않으며, A 명세 뒤 B 명세를 등록한 상태에서 A를 시공합니다. NPC 입력 오류를 교정한 뒤 정상 저장합니다.");
  } finally {
    await page.unroute("**/v1/chat/completions", handler);
  }
  assert.equal(result.ok, true);
  const audit = result.harness.audit;
  const calls = audit.filter((entry) => entry.kind === "tool");
  const specs = calls.filter((entry) => entry.name === "set_build_spec");
  assert.deepEqual(specs.map((entry) => [entry.args.mapId, entry.ok]), [[mapA, false], [mapA, true], [mapB, true]]);
  const fills = calls.filter((entry) => entry.name === "fill_region");
  assert.deepEqual(fills.map((entry) => [entry.args.mapId, entry.ok]), [[mapA, true], [mapB, true]]);
  const props = calls.find((entry) => entry.name === "place_props");
  assert.equal(props?.deferred, true);
  assert.deepEqual(props?.issueCodes, ["build-spec-dependency-failed"]);
  const npcs = calls.filter((entry) => entry.name === "place_npc");
  assert.deepEqual(npcs.map((entry) => entry.ok), [false, false, false, true]);
  const repairs = npcs.slice(0, 3).map((entry) => {
    const line = entry.issues.flatMap((issue) => issue.split("\n")).find((text) => text.startsWith("repair: "));
    assert.ok(line);
    return JSON.parse(line.slice("repair: ".length));
  });
  assert.deepEqual(repairs[0], { path: "pages", example: [{ lines: [lines.join("\n")] }] });
  assert.deepEqual(repairs[1], { path: "pages[0].commands[0]", example: { kind: "text", body: lines.join("\n") } });
  assert.deepEqual(repairs[2], { path: "pages[1].conditions", example: [{ kind: "selfSwitch", key: "A", value: true }] });
  const completions = result.harness.messages
    .filter((entry) => entry.role === "tool" && entry.name === "complete_work_item")
    .map((entry) => JSON.parse(entry.content));
  assert.equal(completions[0].data.reason, "work-dependency-failed");
  assert.equal(completions.at(-1).data.alreadyComplete, true);
  const observed = await page.evaluate(({ mapA, mapB, npcId }) => {
    const project = window.__oprnEditorStore.getCurrent();
    return {
      maps: [mapA, mapB].map((id) => ({ id, width: project.maps[id].width, height: project.maps[id].height })),
      npc: project.maps[mapA].events.find((entry) => entry.id === npcId),
    };
  }, { mapA, mapB, npcId });
  assert.deepEqual(observed.maps.map((map) => [map.width, map.height]), [[20, 15], [20, 15]]);
  assert.equal(observed.npc.pages.length, 2);
  assert.deepEqual(observed.npc.pages[0].commands.filter((command) => command.kind === "text").map((command) => command.body), [lines.join("\n")]);
  assert.deepEqual(observed.npc.pages[1].conditions, [{ kind: "selfSwitch", key: "A", value: true }]);
  return { modelOutputSource: "recorded replay, not a live model", mapA, mapB, requests, result, observed };
}
