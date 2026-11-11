// 게임 내용 검사 — 플레이어 눈에 보이는 것: 맨땅인 조사 이벤트·투명 페이지의 대사·선택지 메모·메뉴, 그림 크기·이름·HUD·타이틀·주인공.
import { choiceMetaTag } from "@/project/choiceText";
import { fieldMenu } from "@/project/fieldMenu";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { buildsWholeGame } from "../request/readers";
import { lookMismatches, oversizedSprites, pristineFantasyHero, titleBackdropMismatch } from "./lookChecks";
import { projectCanLoseHp, resolvedHudWidgets } from "@/project/fieldHud";
import { HIDDEN_WORDS } from "../request/asks";
import { tagged, type Finding } from "./finding";
import { type GameCheck, Obj, obj } from "./gameCheckReads";

/** 플레이어 눈에 보이는 것 — 맨땅인 조사 이벤트, 그림 없는 페이지의 대사, 선택지에 남은 제작 메모, 전투를 못 준비하는 메뉴. */
export function shownChecks({ after, task, changed, cmds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 1c) 눈에 안 보이는 «조사하는» 물건: 새로 만든 결정 키(action) 이벤트에 그림도 없고 그 칸에 물건 타일도 없다(이동석·덤불·표지판이 맨땅으로 보였다).
  if (!HIDDEN_WORDS.test(task)) {
    for (const ev of changed) {
      if (ev.mapId === "common") continue;
      const map = after.maps[ev.mapId] as unknown as Obj | undefined;
      const raw = ((map?.events as Obj[] | undefined) ?? []).find((e) => e.id === ev.id);
      if (!map || !raw) continue;
      const pages = ev.pages;
      // 조사하는 쪽 = 결정 키로 열리고 명령이 있는 쪽. 명령이 없는 action 쪽(목표 줄 이벤트 ev_objective_* 의 «다 보여 준 뒤» 빈 쪽)은 조사할 것이 없다 —
      // 2026-11-10 Terra 두 판(jrpg-w1·fun-w1): set_objective 가 지은 「시작 목표」가 «맨땅» 으로 걸려 조수가 그 칸 위에 물건을 찍었다.
      const examinePages = pages.filter((pg) => obj(pg.trigger)?.kind === "action" && Array.isArray((pg as Obj).commands) && ((pg as Obj).commands as unknown[]).length > 0);
      if (!examinePages.length) continue;
      if (pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); })) continue;
      const w = Number(map.width), i = Number(raw.y) * w + Number(raw.x);
      const at = (layer: unknown) => Array.isArray(layer) ? Number(layer[i]) : -1;
      // 도구가 만든 장면 받침(ev_cutscene_*·호위 목적지)은 빼고, 그 칸이나 바로 위(북쪽) 칸에 물건 타일·건물 도장이 있으면 «그 물건 앞»이라 본다.
      if (/^ev_(cutscene|escort)_/u.test(ev.id)) continue;
      // 바닥에 떨어진 증거(evidenceOnThing `<사람 id>_evidence`)는 그림 대신 가까이 오면 반짝인다(nearSparkle) — 맨땅이 아니다.
      // 이 칸에 「물건을 찍거나 옮겨라」를 내면 모델이 칸을 일곱 번 옮기고 대사의 자리 말과 어긋났다(2026-10-31 mef3 terra 추리).
      if (examinePages.every((pg) => !!obj((pg as Obj).nearSparkle))) continue;
      const x0 = Number(raw.x), y0 = Number(raw.y), h = Number(map.height);
      let near = false;
      for (const [dx, dy] of [[0, 0], [0, -1]] as const) {
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        const v = (layer: unknown) => Array.isArray(layer) ? Number(layer[j]) : -1;
        if (v(map.upperTiles) > 0 || v(map.lowerOverlayTiles) > 0) near = true;
      }
      const inStamp = ((map.structurePlacements as Obj[] | undefined) ?? []).some((sp) => x0 >= Number(sp.x) && x0 < Number(sp.x) + Number(sp.w) && y0 >= Number(sp.y) && y0 < Number(sp.y) + Number(sp.h));
      if (near || inStamp || at(map.upperTiles) > 0) continue;
      problems.push(tagged("game", "보임", `「${ev.name}」(${ev.id}) 는 조사하는 이벤트인데 그림도 없고 그 칸(${String(raw.x)},${String(raw.y)})에 물건 타일도 없다 — 플레이어 눈에 맨땅이다. list_spatial_designs{kind:'object',query:'비석·돌·분수·나무…'} 로 물건을 찾아 stamp_object 로 그 칸 바로 위(${String(raw.x)},${Number(raw.y) - 1})나 그 칸에 찍거나, 이벤트를 이미 있는 물건 앞으로 move_event 한다.`));
    }
  }
  // 1c2) 그림 있는 사람의 「그림 없는 기본 페이지」가 말을 한다 — 장면 전에는 빈 바닥인데 결정 키를 누르면 대사가 나온다
  //   (2026-10-25 장난감 가게 G38: 회상 대역 ev_flashback_* 의 투명 페이지 0 에 「젊은 제페토: …」 한 줄).
  for (const ev of changed) {
    if (ev.mapId === "common" || /^ev_(cutscene|escort)_/u.test(ev.id)) continue;
    const drawn = (pg: Obj) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); };
    if (!ev.pages.some((pg) => drawn(pg as unknown as Obj))) continue;
    const bare = ev.pages.find((pg) => { const p = pg as unknown as Obj; return !drawn(p) && obj(p.trigger)?.kind === "action" && !((p.conditions as unknown[] | undefined) ?? []).length
      && ((p.commands as Obj[] | undefined) ?? []).some((c) => c.kind === "text"); });
    if (bare) problems.push(tagged("game", "보임", `「${ev.name}」(${ev.id}) 의 그림 없는 기본 페이지가 말을 한다 — 그 사람이 보이기 전에는 빈 바닥인데 결정 키를 누르면 대사가 나온다. 그 페이지의 대사를 비우거나(명령 없음) 보이는 페이지에만 대사를 둔다.`));
  }
  // 1c3) 선택지 문구에 제작 메모 꼬리표 — 「(엔딩)」「(배드 엔딩)」「(+1일)」은 스포일러이자 제작 흔적이다(2026-10-25 판정 J37).
  //   런타임도 보여 줄 때 걷지만(playerChoiceText), 저작본에서 지워야 편집기·대화 기록에도 남지 않는다.
  for (const r of cmds) {
    if (r.cmd.kind !== "choices" || !Array.isArray(r.cmd.options)) continue;
    const noted = (r.cmd.options as Obj[]).map((o) => ({ text: String(o?.text ?? ""), tag: choiceMetaTag(String(o?.text ?? "")) })).filter((o) => o.tag);
    if (noted.length) problems.push(tagged("game", "선택지", `「${r.ev.name}」(${r.ev.id}) 의 선택지에 제작 메모가 보인다: ${noted.slice(0, 3).map((o) => `「${o.text}」`).join(" · ")} — 플레이어 문구에서 ${noted.map((o) => o.tag).filter((t, i, a) => a.indexOf(t) === i).join("·")} 를 지운다(엔딩·날짜 경과는 선택 뒤 장면이 보여 준다).`));
  }
  // 1c4) 전투 없는 이야기 메뉴인데 전투를 넣었다 — 스킬·장비가 메뉴에 없어 전투 준비를 못 한다.
  {
    const menu = fieldMenu(after);
    const commands = new Set(menu?.entries.map((e) => e.command) ?? []);
    if (menu && !commands.has("skills") && !commands.has("equipment") && !usesRelationshipMenu(after) && cmds.some((r) => r.cmd.kind === "battleProcessing")) {
      problems.push(tagged("game", "메뉴", "전투(battleProcessing)를 넣었는데 ESC 메뉴가 전투 없는 이야기용이다 — 스킬·장비·상태를 볼 수 없다. configure_field_menu{preset:'default'} 로 기본 메뉴로 되돌리거나 custom add 로 skills·equipment·status 를 더한다."));
    }
  }
  return problems;
}

/** 그림 — 크기, 이름과 어긋난 그림·얼굴, 까닭 없는 체력 HUD, 시대와 어긋난 타이틀, 장르와 어긋난 주인공. */
export function lookChecks({ before, after, task }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 그림 크기(J23): 보스가 아닌데 파티보다 훨씬 크게 그린 칩.
  problems.push(...oversizedSprites(before, after));
  // 그림 ↔ 이름(J35·J30·J41): 젊은 인물에 노인 얼굴, 인형·태엽 병정에 사람 얼굴, 하얀 드레스에 분홍 드레스 칩.
  problems.push(...lookMismatches(before, after));
  // 체력이 줄 일이 없는 게임에 체력 HUD(공포 꽃잎·하트)가 설명 없이 떠 있다(2026-10-25 심사 J67). 이번 실행이 HUD 를 바꿨을 때만.
  if (JSON.stringify(before.system.fieldHud ?? null) !== JSON.stringify(after.system.fieldHud ?? null) && after.system.fieldHud
    && resolvedHudWidgets(after.system.fieldHud).some((widget) => widget.source === "hp") && !projectCanLoseHp(after)) {
    problems.push(tagged("game", "HUD", `필드 HUD(${after.system.fieldHud.theme})가 체력(꽃잎·하트)을 늘 보이는데 이 게임에는 체력이 줄 일(전투·피해 명령·인카운트)이 없다 — 플레이어에게 설명 없는 장식이다. set_field_hud{theme:'${after.system.fieldHud.theme}', vitals:false} 로 끄거나, 체력을 쓰는 게임이면 피해를 주는 장치(함정·추격자 changeActorHp)를 만들고 set_life_flower 로 꽃잎의 뜻을 보인다.`));
  }
  // 타이틀 그림 ↔ 시대(J38): 이번에 타이틀을 바꿨을 때만.
  if (JSON.stringify(before.system.titleScreen ?? null) !== JSON.stringify(after.system.titleScreen ?? null)) problems.push(...titleBackdropMismatch(after, task));
  // 주인공 모습 ↔ 장르(J43): 게임을 만드는 요청은 출하 검사(hero-look)가 이미 짚는다. 그 밖에는 이번에 장소(맵)를 새로 지은 실행만 —
  // 시작 위치 옮기기 같은 작은 고치기에서 시키지 않은 주인공 바꾸기를 시키지 않는다.
  if (!buildsWholeGame(after, task) && Object.keys(after.maps).some((id) => !before.maps[id])) problems.push(...pristineFantasyHero(after, task));
  return problems;
}
