// 게임 내용 검사 — 이야기 흐름과 장면: 너무 빨리 끝남·단서·추격자·퍼즐 사슬, 순서·회상·시계·막 끝·레터박스·오프닝.
import { gatesThatOpenNothing, lockBypasses, placeholderTexts, selfRevealingLocks, unjoinedFollowers, weakPuzzleLocks } from "./puzzleChecks";
import { asksActEnd, asksAfterStep, asksChaserBehavior, asksClueForLock, asksLetterbox, asksOpening, asksShownFlashback, saysNewGame } from "../request/readers";
import { unsafeSpawnLines } from "@/project/chaserSpawnSafety";
import { tagged, type Finding } from "./finding";
import { instantEndings, skippableClues, slowChasers, vanishingChasers, duplicateMaps, flatPerDayPeople, deadClues } from "./storyFlowChecks";
import { type GameCheck, Obj, obj, dayCounterVariables, allCommands, flatConditions } from "./gameCheckReads";

/** 이야기 흐름 — 시작하자마자 끝남, 건너뛰는 단서, 추격자, 카메라 배율, 위험한 시작 칸, 퍼즐 사슬, 겹친 맵, 날마다 다른 대사. */
export function storyChecks({ before, after, task, changed }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 시작하자마자 끝나는 게임: 확인 키만 몇 번 눌러도 엔딩·게임 오버(2026-10-25 조수 단독 게임 G24 — 시작 칸 바로 앞이 정문이고 첫 항목이 「혼자 도망친다(배드 엔딩)」).
  {
    const startTouched = after.startMapId !== before.startMapId || JSON.stringify(after.startPos) !== JSON.stringify(before.startPos);
    const changedIds = new Set(changed.map((ev) => ev.id));
    const instant = instantEndings(after).filter((line) => startTouched || [...changedIds].some((id) => line.includes(`(${id},`)));
    if (instant.length) problems.push(tagged("game", "시작", `시작하자마자 확인 키만 눌러도 게임이 끝난다: ${instant.slice(0, 3).join(" / ")} — 끝내는 항목은 고르기 창의 마지막 항목으로 옮기고(첫 항목은 「돌아간다」처럼 이어지는 쪽), 시작 칸을 그 이벤트에서 떨어뜨리거나(set_start_position) 그 엔딩을 앞 일을 마친 뒤의 스위치 조건 페이지로 옮긴다.`));
  }
  // 단서를 건너뛰는 퍼즐·한 번 숨으면 사라지는 추격자(G25) — 바뀐 이벤트만.
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const clues = skippableClues(after).filter((line) => [...changedIds].some((id) => line.includes(`(${id})`)));
    if (clues.length) problems.push(tagged("game", "퍼즐", `${clues.slice(0, 3).join(" / ")}. 단서 전 페이지에서는 보상 항목을 빼고 「뭔가 단서가 필요하다」 대사만 두며, 보상은 단서 스위치 조건 페이지에만 남긴다.`));
    if (asksClueForLock(task)) {
      // 숫자·글자를 입력하는 자물쇠는 답을 알아야 풀리니 단서 스위치로 막지 않아도 된다 — 고르기 창으로 찍어 맞힐 수 있는 퍼즐만 본다.
      const guessable = changed.some((ev) => !allCommands(ev).some((r) => /^input/u.test(String(r.cmd.kind)))
        && allCommands(ev).some((r) => r.cmd.kind === "choices" && JSON.stringify(r.cmd.options ?? []).match(/"kind":"(changeItem|setSwitch)"/u)));
      const dead = guessable ? deadClues(after, changedIds) : [];
      if (dead.length) problems.push(tagged("game", "퍼즐", `${dead.slice(0, 3).join(" / ")} — 퍼즐 이벤트가 그 스위치를 보지 않아 단서를 안 읽어도 풀린다. 퍼즐 이벤트의 첫 페이지는 「뭔가 단서가 필요하다」 대사만 두고, 정답 고르기·보상은 그 단서 스위치 조건의 다음 페이지로 옮긴다.`));
    }
    const slow = slowChasers(after, changedIds);
    if (slow.length) problems.push(tagged("game", "위협", `${slow.slice(0, 3).join(" / ")}. 추격 페이지 movement 를 speed 6 이상·frequency 8 로 두거나(빠른 걸음새가 필요하면 approachStyle dash·swoop) — make_chase_scene 기본값(speed 6·frequency 8)이 그 값이다. 느린 추격이 의도면(숨바꼭질형) 보고에 적는다.`));
    const chasers = vanishingChasers(after).filter((line) => [...changedIds].some((id) => line.includes(`(${id})`)));
    if (chasers.length) problems.push(tagged("game", "위협", `${chasers.slice(0, 3).join(" / ")}. 숨기가 «이번 한 번» 지나가게 하는 것이면 그 스위치를 다시 끈다(예: 옷장에서 나온 뒤 기다렸다 setSwitch false, 또는 맵을 나갈 때), 영영 사라지는 것이 요청이면 보고에 적는다.`));
  }
  // 말로만 쫓는 추격자(2026-10-25 심판 J54): 요청이 「시야·추격·순찰·느낌표」인데 바뀐 이벤트 어디에도 쫓는 움직임·순찰 길·시야가 없다.
  {
    const asked = asksChaserBehavior(task);
    const built = changed.some((ev) => ev.pages.some((pg) => {
      const mv = obj(pg.movement) ?? obj(pg.moveRoute);
      return !!mv && (mv.type === "chase" || !!obj(mv.route) || !!obj(mv.sight) || typeof mv.sightRange === "number");
    }));
    if (asked && !built) problems.push(tagged("game", "위협", `요청은 시야·추격·순찰인데 이번에 바꾼 이벤트에 쫓는 움직임(movement.type 'chase')·순찰 길(movement.route)·시야가 하나도 없다 — make_chase_scene{mapId, chaser, patrol:{mode:'auto'}} 로 실제 추격자를 만들거나(이미 있으면 configure_npc_patrol 로 순찰 길을 더한다), 못 지었으면 보고에 「추격 없음」이라고 적는다. 대사·느낌표 말풍선만으로는 쫓아오지 않는다.`));
  }
  // 맵 기본 배율을 이벤트로 켜고 끄기(2026-10-25 J69): 자동 실행 페이지가 카메라 배율만 건다 — 저장·불러오기·맵 재진입에서 어긋나고 매번 한 박자 늦게 걸린다.
  {
    const zoomOnly = changed.filter((ev) => ev.mapId !== "common" && ev.pages.some((pg) => {
      const trig = String(obj(pg.trigger)?.kind ?? pg.trigger ?? "");
      if (trig !== "auto" && trig !== "parallel") return false;
      const cmds = Array.isArray(pg.commands) ? (pg.commands as Obj[]) : [];
      const zoom = cmds.some((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control" && obj(c.fields)?.zoom !== undefined || c.kind === "cameraControl" && c.zoom !== undefined);
      return zoom && cmds.every((c) => ["m2Command", "cameraControl", "setSelfSwitch", "eraseEvent", "wait", "comment"].includes(String(c.kind)) && (c.kind !== "m2Command" || c.commandId === "m2-201-camera-control"));
    }));
    if (zoomOnly.length) problems.push(tagged("game", "카메라", `자동 실행 이벤트가 맵 카메라 배율만 건다: ${zoomOnly.slice(0, 3).map((ev) => `「${ev.name}」(${ev.id}) @${ev.mapId}`).join(", ")} — 맵 기본 배율은 set_map_properties{mapId, zoom} 로 맵에 두고 그 이벤트는 지운다(들어올 때마다 바로 걸리고 저장·불러오기에서도 맞다). 장면 중 잠깐 당기는 줌만 연출 명령으로 둔다.`));
  }
  // 태어나자마자 잡히는 시작·체크포인트(2026-10-25 심판 J61).
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const startTouched = after.startMapId !== before.startMapId || JSON.stringify(after.startPos) !== JSON.stringify(before.startPos);
    const unsafe = unsafeSpawnLines(after).filter((entry) => startTouched || changedIds.has(entry.eventId) || (!!entry.spotEventId && changedIds.has(entry.spotEventId)));
    if (unsafe.length) problems.push(tagged("game", "위협", `${unsafe.slice(0, 3).map((entry) => entry.line).join(" / ")}. 추격자를 시야 밖(벽 너머·다른 방)에 두거나, set_start_position 으로 시작을 옮기거나, 체크포인트를 추격 구역 앞(문 밖)으로 옮긴다.`));
  }
  // 사슬 전체 검사(2026-10-25 판정 J11~J14): 잠긴 방이 벽 틈으로 열림·자물쇠가 답을 말함·자리 표시 글·파티에 없는 동료.
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const bypass = lockBypasses(after, changedIds);
    if (bypass.length) problems.push(tagged("game", "잠긴 방", `${bypass.slice(0, 3).join(" / ")}. seal_locked_room{mapId, eventId} 로 문 말고 다른 길(벽 틈)을 막거나, 퍼즐 전체를 author_puzzle_chain 으로 다시 묶는다.`));
    const idle = gatesThatOpenNothing(after, changedIds);
    if (idle.length) problems.push(tagged("game", "퍼즐", `${idle.slice(0, 3).join(" / ")}. 장치가 연 칸 말고 다른 길(벽 틈·옆 통로)을 막아 그 칸이 유일한 길이 되게 하거나(seal_locked_room), 보스 방 앞 진짜 외길에 장치를 다시 둔다.`));
    const weak = weakPuzzleLocks(after, changedIds);
    if (weak.length) problems.push(tagged("game", "퍼즐", `${weak.slice(0, 3).join(" / ")}. 답은 단서에서만 알 수 있는 번호(날짜·시계 바늘·쪽수를 이은 것)로 바꾸고 단서 대사도 같이 고친다. 고르기면 정답을 첫 보기가 아닌 자리에 둔다(author_puzzle_chain 은 자동으로 섞는다).`));
    const leaks = selfRevealingLocks(after, changedIds);
    if (leaks.length) problems.push(tagged("game", "퍼즐", `${leaks.slice(0, 3).join(" / ")}. 자물쇠 대사에서 답을 빼고(「번호를 모르겠다」), 답은 단서(일기·쪽지)에만 두고 단서를 읽으면 켜지는 스위치 조건 페이지에서만 입력받는다 — author_puzzle_chain 이 이 순서로 짓는다.`));
    const holes = placeholderTexts(after, changedIds, JSON.stringify(after.system.opening ?? null) !== JSON.stringify(before.system.opening ?? null) || JSON.stringify(after.endings ?? []) !== JSON.stringify(before.endings ?? []));
    if (holes.length) problems.push(tagged("game", "글", `화면에 그대로 보이는 자리 표시가 남았다: ${holes.slice(0, 4).join(" / ")} — 주인공 이름은 실제 이름(또는 \\N[1])으로, 줄바꿈 「\\n」 글자는 실제 줄바꿈으로 고친다.`));
    const loners = unjoinedFollowers(after, changedIds, task);
    if (loners.length) problems.push(tagged("game", "동료", `${loners.slice(0, 3).join(", ")} 가 그림만 따라오고 파티에는 없다(메뉴에 안 보인다) — 이야기가 「함께 간다」면 upsert_actor 로 배우를 만들고 {kind:'changeParty',actorId,action:'add'} 와 {kind:'addFollower',actorId} 를 같이 넣는다(또는 add_companion). 잠깐 따라오는 것뿐이면 보고에 적는다.`));
  }
  // 같은 역할의 맵이 둘(G19: 「저택 2층」 두 장, 「지하 예배당」 두 장 — 계단이 2층→2층으로 이어졌다).
  {
    const dups = duplicateMaps(before, after);
    if (dups.length) problems.push(tagged("game", "맵", `같은 이름·역할의 맵이 둘 있다: ${dups.slice(0, 3).join(" / ")} — 하나만 남기고 그 맵으로 가는 문을 그 하나로 모은 뒤, 남는 맵은 remove_map 으로 지운다(지울 수 없으면 이름을 바꿔 역할을 나눈다).`));
  }
  // 날마다 달라지는 대사를 사람마다(G13: 서연만 고치고 지훈은 그대로 두고 「다 했다」).
  {
    const flat = flatPerDayPeople(after, task);
    if (flat.length) problems.push(tagged("game", "대사", `요청은 날마다 대사가 달라지게인데 이 사람들은 날짜(일차 변수)로 갈리는 대사가 셋 미만이다: ${flat.slice(0, 4).join(" / ")} — 그 사람의 이벤트에 일차 변수 조건 페이지(1일차·2일차·3일차 이상…)를 더해 날마다 다른 말을 하게 한다(호감 단계 페이지는 따로 둔다).`));
  }
  return problems;
}

/** 장면 — 순서 있는 이야기의 조건, 회상, 밤낮과 시계, 날짜 세기, 막 끝 카드, 레터박스, 오프닝. */
export function sceneChecks({ before, after, task, changed, cmds, kinds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 순서가 있는 이야기: 「숲을 조사하고 돌아오면 … 제1막 끝」인데 엔딩·막 끝이 조건 없는 페이지에 있어 첫 대화에 바로 터진다
  // (2026-10-25 폴른 과업 fs-end-act: 숲에 가기도 전에 촌장 첫 대화에서 마을 습격 + 「제1막 끝」).
  if (asksAfterStep(task)) {
    for (const r of cmds) {
      const endingText = r.cmd.kind === "text" && /제\s*\d+\s*막\s*끝|막이?\s*끝|THE END/iu.test(String(r.cmd.body ?? ""));
      if ((r.cmd.kind !== "triggerEnding" && !endingText) || r.ev.mapId === "common") continue;
      const gated = flatConditions(r.page.conditions).length > 0 || r.guards.length > 0;
      const trig = String(obj(r.page.trigger)?.kind ?? "action");
      if (gated || (trig !== "action" && trig !== "touch" && trig !== "autorun")) continue;
      problems.push(tagged("game", "순서", `요청은 앞 일을 마친 «뒤»에 일어나는 이야기인데 「${r.ev.name}」(${r.ev.id}) ${r.pageIndex + 1}쪽의 ${endingText ? "막 끝 장면" : `엔딩(triggerEnding ${String(r.cmd.endingId ?? "")})`}이 조건 없는 페이지에 있어 처음 말 걸거나 밟자마자 터진다. 앞 일(숲 끝·보스·조사)을 마치는 이벤트가 스위치를 켜고(declare_story_flag), 이 장면은 그 스위치 조건의 더 높은 번호 페이지로 옮긴다 — 조건 전 페이지에는 「아직」 대사를 둔다.`));
      break;
    }
  }
  // 회상(과거 장면): 화면 색만 바꾸고 지금 인물이 옛이야기를 읽어 주면 과거 장면이 아니다 — 과거 인물이 화면에 나와야 한다
  // (2026-10-25 장난감 가게 G34: 「장난감에게 말 걸면 과거 장면이 보이게」에 세피아 색 + 장난감 독백만 넣었다).
  if (asksShownFlashback(task)) {
    const others = (ev: { id: string }) => cmds.some((r) => r.ev.id === ev.id && (
      (r.cmd.kind === "moveEvent" && r.cmd.eventId !== undefined && r.cmd.eventId !== "player")
      || (r.cmd.kind === "m2Command" && /m2-225/u.test(String(r.cmd.commandId)) && Number((r.cmd.fields as Obj | undefined)?.opacity ?? 0) > 0)
      || (r.cmd.kind === "look" && r.cmd.target !== "player")));
    const tinted = changed.filter((ev) => cmds.some((r) => r.ev.id === ev.id && (r.cmd.kind === "tint" || (r.cmd.kind === "m2Command" && /m2-046|m2-202/u.test(String(r.cmd.commandId))))));
    if (tinted.length && !changed.some(others)) {
      problems.push(tagged("game", "회상", "요청은 과거 장면이 화면에 보이는 회상인데, 바꾼 이벤트는 화면 색만 바꾸고 지금 인물이 옛이야기를 말한다 — 과거 인물이 나오지 않는다. add_event{kind:'cutscene',when:'talk',after:'<말 거는 대상 이름>',beats:[{do:'tint',tone:'sepia'},{do:'appear',who:'<과거 인물>'},{do:'walk',…},{do:'say',who:'<과거 인물>',text:…},{do:'vanish',who:'<과거 인물>'},{do:'tint',tone:'clear'}]} 로 과거 인물을 세워 움직이고 말하게 한다(장면 뒤에는 사라진다)."));
    }
  }
  // 밤·낮을 스위치와 화면 색으로만 바꾸는데 시간 체계가 켜져 있으면 HUD 시계는 따로 흘러 「자정」 뒤에도 「06:16」을 보인다
  // (2026-10-25 장난감 가게 G51). 그 갈래에 setTime 을 같이 넣거나, 시계를 안 쓰면 시간 체계를 끈다.
  if ((after.system.timeSystem as { enabled?: boolean } | undefined)?.enabled) {
    const nightTint = (cmd: Obj): boolean => {
      const fields = (cmd.fields ?? {}) as Obj;
      const text = `${String(fields.value ?? "")} ${String(fields.color ?? "")} ${String(cmd.tone ?? cmd.color ?? "")}`;
      if (/night|밤|dusk|midnight/iu.test(text)) return true;
      const rgba = String(fields.value ?? "").split(",").map(Number);
      return rgba.length >= 3 && rgba.slice(0, 3).every((v) => Number.isFinite(v) && v <= 90) && (rgba[3] === undefined || rgba[3] >= 0.25);
    };
    const timeKinds = new Set(["setTime", "advanceTime", "sleepUntilMorning"]);
    const off: string[] = [];
    for (const ev of changed) {
      const rows = allCommands(ev);
      const tints = rows.filter((r) => (r.cmd.kind === "tint" || (r.cmd.kind === "m2Command" && /m2-046/u.test(String(r.cmd.commandId)))) && nightTint(r.cmd));
      if (!tints.length || !rows.some((r) => r.cmd.kind === "setSwitch")) continue;
      if (rows.some((r) => timeKinds.has(String(r.cmd.kind)))) continue;
      off.push(`「${ev.name}」(${ev.id})`);
    }
    if (off.length) problems.push(tagged("game", "시계", `시간 체계가 켜져 있어 화면 시계(HUD)가 따로 흐르는데, ${off.slice(0, 3).join(", ")} 은 밤을 스위치와 화면 색으로만 만든다 — 「자정」 뒤에도 시계는 아침 시각을 보인다. 밤으로 바꾸는 갈래에 {kind:'setTime',hour:24,minute:0}(자정), 낮으로 돌리는 갈래에 {kind:'setTime',hour:6,minute:0} 을 같이 넣는다. 시계가 필요 없는 이야기면 configure_time_system{enabled:false} 로 끈다.`));
  }
  // 날짜를 두 번 센다(2026-10-25 판정 J18, 서울 연애): 시간 체계가 켜져 HUD 달력이 「봄 4일」을 보이는데 대사·엔딩은
  // 「서울에서 보낸 일수」 변수로 1일차를 센다. 대화마다 advanceTime 이 달력을 넘기고 잠자기가 또 넘겨 두 날짜가 어긋난다.
  // onDayEnd 공통 이벤트 안의 카운트(set_deadline_ending 의 var_days_elapsed)는 달력과 같이 넘어가므로 뺀다.
  {
    const ts = after.system.timeSystem as { enabled?: boolean; onDayEnd?: string } | undefined;
    const dualDays = ts?.enabled ? dayCounterVariables(after, ts.onDayEnd) : [];
    const touched = changed.some((ev) => allCommands(ev).some((r) => r.cmd.kind === "setVariable" && dualDays.some((d) => d.id === r.cmd.variableId)))
      || JSON.stringify(before.system.timeSystem ?? null) !== JSON.stringify(after.system.timeSystem ?? null);
    if (dualDays.length && touched) {
      const v = dualDays[0]!;
      problems.push(tagged("game", "시계", `시간 체계가 켜져 HUD 달력(「봄 N일」)이 따로 흐르는데, 날짜를 변수 「${v.name}」(${v.id})로 또 센다(${v.where}) — 대화의 advanceTime·잠자기가 달력을 넘겨 화면 날짜와 대사·엔딩의 「N일차」가 어긋난다. 하나만 쓴다: 변수로 세려면 configure_time_system{enabled:false} 로 달력을 끄고(잠자기 대신 화면 전환·대사로 하루를 넘긴다), 달력을 쓰려면 그 변수를 지우고 날짜는 set_deadline_ending(onDayEnd 카운트)으로 센다.`));
    }
  }
  // 「제1막 끝」 카드: 대사 한 줄로 흉내 내면 게임이 그대로 이어진다 — 진짜 엔딩(막 끝 화면)이어야 한다(fs-end-act).
  if (asksActEnd(task) && !kinds.has("triggerEnding")) {
    problems.push(tagged("game", "엔딩", "요청에 「막 끝」 화면이 있는데 바꾼 이벤트에 진짜 엔딩 명령이 없다 — 대사 「제1막 끝」만으로는 게임이 그대로 이어진다. define_ending{id:'ending_act1',presentation:{finalTitle:'제1막 끝',badge:'제2막으로 이어집니다'}} 뒤 그 장면 끝에 {kind:'triggerEnding',endingId:'ending_act1'} 를 넣는다."));
  }
  // 레터박스(위아래 검은 띠): 컷신이 띠를 저절로 넣지 않는다 — 실제 띠 명령이 있어야 한다(2026-10-25 폴른 과업 fs-cine-letterbox: 「자동」이라 믿고 빠뜨림).
  if (asksLetterbox(task) && JSON.stringify(after.system.opening ?? null) === JSON.stringify(before.system.opening ?? null) && !JSON.stringify(changed.map((ev) => ev.pages)).includes("letterbox")) {
    problems.push(tagged("game", "화면", "요청에 위아래 검은 띠(레터박스)가 있는데 바꾼 이벤트에 띠 명령이 없다 — 컷신은 띠를 저절로 넣지 않는다. add_scene/script_cutscene 의 letterbox 비트({do:'letterbox',show:true,size:12}) 또는 {kind:'m2Command',commandId:'m2-202-screen-effect',fields:{effect:'letterbox',value:12,durationMs:400}} 를 장면 맨 앞에 넣는다."));
  }
  // 새 게임인데 오프닝이 공장 기본(「강을 낀 왕국…」) 그대로 켜져 있다 — 첫 화면부터 다른 이야기가 나온다(2026-10-25 조수 단독 게임 G3).
  {
    const op = after.system.opening as { enabled?: boolean; scenes?: { narration?: string; resourceId?: string }[] } | undefined;
    const factory = !!op?.enabled && (op.scenes ?? []).some((sc) => /강을 낀 왕국에는 오래도록 전쟁이 없었다/u.test(sc.narration ?? "") || sc.resourceId === "oprn-still-kingdom-day");
    const newGame = after.meta.title !== before.meta.title || saysNewGame(task);
    // 요청이 오프닝을 고치라는데 공장 기본이 그대로면, 설정(켜기·음악)만 바꿨어도 문제다 — 「오프닝을 새로 만들었다」는 거짓 보고가 났다(2026-10-25 G35).
    const openingAsk = asksOpening(task);
    if (factory && (openingAsk || newGame && JSON.stringify(op) === JSON.stringify(before.system.opening))) {
      problems.push(tagged("game", "오프닝", "게임을 새로 만들었는데 오프닝이 프로젝트 기본(「강을 낀 왕국에는 오래도록 전쟁이 없었다」)이 그대로 켜져 있다 — 새 게임 첫 화면에 엉뚱한 이야기가 나온다. plan_opening/set_opening 으로 이 게임 이야기(주인공·목표) 몇 장면으로 바꾸거나, 오프닝을 원하지 않으면 set_opening{enabled:false}."));
    }
  }
  return problems;
}
