/**
 * 『폴른 스타』 왕도 아스텔의 집 안(2026-10-21 사용자 「마을 집에 들어갈 수 없다」).
 *
 * 마을 블록의 집 문(버들항 「집 문」 칸) 가운데 플레이어가 들어가 볼 곳을 손 도트 실내 v5(build_hand_interior_room)로 짓고
 * 부딪힘 문(create_transfer_pair doorAt)으로 잇는다. 여관(숙박)·약방(사고팔기)·집 셋(이야기 대사 — 떨어진 별·심문관 발렌·
 * 천문대·이리스). 나머지 문은 가짜 문이 되지 않게 「잠겨 있다」 한 줄을 단다.
 */
import { runTool } from "@/editor/tools/toolRunner";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { GameMap, Project } from "@/project/types";

type Cell = { x: number; y: number };
type Run = { ok: boolean; summary?: string; issues?: unknown; data?: unknown };

const DOOR_LABEL = "버들항 · 집 문";

type Home = {
  readonly door: Cell;
  readonly mapId: string;
  readonly name: string;
  /** build_hand_interior_room 의 layout — 집마다 쓰임에 맞춘 방 구성(rooms·seed·variant). 화면(30×17칸)을 거의 채우는 크기로 고른다. */
  readonly layout: Record<string, unknown>;
  /** 빈 마루를 쓰임에 맞게 채우는 가구(키트 id, x, y) — 방 배치가 seed 로 고정이라 칸을 정해 둔다. 못 놓이면 건너뛴다. */
  readonly dress?: readonly (readonly [string, number, number])[];
  readonly bgm: string;
  readonly people: readonly {
    readonly id: string; readonly name: string; readonly query: string;
    /** 이름 있는 사람마다 다른 칩(RTP 칩셋 텍스처·자리). */
    readonly chip: readonly [string, number];
    /** 계산대 뒤에 선다(앞 칸에 투명한 대리 이벤트를 두어 계산대 너머로 말을 건다). */
    readonly behindCounter?: boolean;
    readonly lines: readonly string[]; readonly after: readonly string[];
    readonly commands?: readonly Record<string, unknown>[];
  }[];
};

function run(project: Project, name: string, args: Record<string, unknown>): Run {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false }) as Run;
  if (!res.ok) throw new Error(`[fallen-town-interiors] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return res;
}

function isDoor(project: Project, map: GameMap, c: Cell): boolean {
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const i = c.y * map.width + c.x;
  return [map.upperTiles[i], map.lowerTiles[i]].some((t) => t !== undefined && t >= 0 && meta[t]?.label === DOOR_LABEL);
}

/** 집 문 칸 전부(문 앞 칸이 걸을 수 있는 것). */
function townDoors(project: Project, map: GameMap): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < map.height - 1; y += 1) for (let x = 0; x < map.width; x += 1) if (isDoor(project, map, { x, y })) out.push({ x, y });
  return out;
}

export function buildFallenTownInteriors(project: Project, hubId: string, ids: { irisJoined: string; valenMarched: string }): { built: string[]; locked: Cell[] } {
  const hub = project.maps[hubId]!;
  const after = (switchId: string) => [{ kind: "switch", switchId, value: true }];
  const shopItems = (project.database.items ?? []).filter((i) => (i.price ?? 0) > 0 && i.type === "medicine").slice(0, 4).map((i) => i.id);
  const homes: Home[] = [
    {
      door: { x: 50, y: 31 }, mapId: "fs_inn", name: "아스텔 · 별빛 여관", bgm: "cc0-bgm-rtp-rst-001",
      // 선술집 홀 + 손님방 셋 + 부엌·저장고 — 「여관인데 침대가 없다」(VQA r5).
      layout: { program: "inn", seed: 5, variant: 1, styleVariant: "A" },
      // 위층 휴게 홀(비어 있었다)에 찻상 두 벌, 아래 선술집 남쪽에 식탁 두 벌·술통 걸이.
      dress: [["tea 2x2", 9, 4], ["chair E", 8, 4], ["chair W", 11, 4], ["tea 2x2", 17, 4], ["chair E", 16, 4], ["chair W", 19, 4], ["luggage trunk", 26, 5],
        ["dining 2x1", 18, 15], ["chair S", 18, 14], ["chair S", 19, 14], ["chair N", 18, 16], ["chair N", 19, 16],
        ["dining 2x1", 28, 15], ["chair S", 28, 14], ["chair S", 29, 14], ["chair N", 28, 16], ["chair N", 29, 16], ["keg rack", 30, 17]],
      people: [
        {
          id: "ev_fs_inn_keeper", name: "여관 주인 마르타", query: "젊은 여성", chip: ["tex_easyrpg_charset_people1", 5], behindCounter: true,
          lines: ["어서 와요, 카엘. 어젯밤 별똥별 봤어요? 손님들이 밤새 창가에 붙어 있었다니까.", "하룻밤 30골드. 푹 쉬고 가요."],
          after: ["그 아이… 이리스라고 했죠? 방은 넉넉해요. 교단 사람들 눈에 안 띄게 안쪽 방을 써요.", "하룻밤 30골드. 푹 쉬고 가요."],
          commands: [{ kind: "inn", price: 30 }],
        },
        {
          id: "ev_fs_inn_bard", name: "떠돌이 악사", query: "젊은 남성", chip: ["tex_easyrpg_charset_people2", 0],
          lines: ["별이 떨어진 밤의 노래를 짓는 중이오. 「동쪽 숲에 은빛 알이 내려앉았네」… 운이 안 맞는군."],
          after: ["은빛 머리 아가씨라… 노래 속 별의 딸 같구려. 걱정 마시오, 교단 앞에선 이 노래 안 부르리다."],
        },
        {
          id: "ev_fs_inn_guest", name: "길손", query: "중년 남성 주민", chip: ["tex_easyrpg_charset_people4", 3],
          lines: ["동쪽 숲 위로 빛기둥이 솟는 걸 봤소. 새벽부터 교단 기사들이 성문을 지키더군."],
          after: ["심문관 발렌이 숲으로 갔다지. 별에서 떨어진 걸 찾는 거라고들 하던데… 찾으면 어쩔 셈인지."],
        },
      ],
    },
    {
      door: { x: 31, y: 31 }, mapId: "fs_apothecary", name: "아스텔 · 약방", bgm: "cc0-bgm-rtp-cln-001",
      // 가게 앞방 + 조제실 + 약재 광 + 지하 저장고 + 서재 + 부부 침실 — 부엌은 두지 않는다(집집마다 같은 부엌이 되풀이됐다, VQA r6).
      // 식료품 광·지하 저장고는 뺐다 — 집집마다 같은 광·저장고·부엌 묶음이 되풀이돼 「같은 저택」으로 읽혔다(VQA r11 major). 쉼터는 약재를 말리며 쉬는 작은 방.
      layout: { rooms: [{ kind: "pharmacy_shop", w: 19, h: 9 }, { kind: "alchemy", w: 9, h: 7 }, { kind: "study" }, { kind: "master_bedroom" }, { kind: "rest" }], seed: 13, variant: 0, styleVariant: "A" },
      dress: [["table:potion+flask", 12, 15], ["herb drying rack", 26, 15], ["basket:herb", 9, 17], ["basket:mushroom", 10, 17],
        ["basket:potion+potionb+potiong", 13, 17],
        // 가게 바닥 가운데가 비었다(VQA r7 minor) — 물약 진열대 하나와 약초 바구니를 더 둔다(문에서 계산대 가는 길은 비운다).
        ["table:potion+flask", 21, 14], ["basket:herb", 23, 16], ["basket:mushroom", 24, 16], ["book pile", 14, 16],
        // 위 왼쪽 조제실이 빈 마루였다(VQA r16) — 약초 건조대·조제 탁자·약초 바구니.
        ["herb drying rack", 13, 4], ["table:potion+flask", 7, 5], ["basket:herb", 10, 7], ["basket:mushroom", 11, 7], ["book pile", 9, 4],
        ["herb drying rack", 4, 7], ["basket:potion+potionb+potiong", 14, 7]],
      people: [
        {
          id: "ev_fs_apothecary", name: "약재상 오든", query: "노인 남성", chip: ["tex_easyrpg_charset_people5", 7], behindCounter: true,
          lines: ["회복약이랑 약초는 여기서 사고팔지. 숲에 간다고? 요즘 늑대가 유난히 사나워."],
          after: ["심문관이 약방까지 와서 「하늘에서 떨어진 것」을 본 사람 없냐고 묻고 갔어. 난 아무것도 못 봤다고 했지."],
          commands: [{ kind: "shop", shopType: "normal", itemIds: shopItems, allowSell: true }],
        },
      ],
    },
    {
      door: { x: 13, y: 11 }, mapId: "fs_bakery_home", name: "아스텔 · 빵집 뒤채", bgm: "cc0-bgm-rtp-caf-001",
      // 빵 진열 가게 + 빵 굽는 방(화덕이 부엌을 겸한다) + 식료품 광 + 지하 저장고 + 침실 + 식당.
      layout: { rooms: [{ kind: "bakery_shop", w: 14, h: 8 }, { kind: "bakery_oven", w: 8, h: 5 }, { kind: "pantry" }, { kind: "cellar" }, { kind: "bedroom" }, { kind: "dining" }], seed: 21, variant: 0, styleVariant: "C" },
      dress: [["table:loaf+bun", 13, 13], ["basket:loaf", 11, 14], ["basket:bun", 12, 14], ["basket:baguette", 11, 13],
        ["roundtable", 27, 13], ["chair E", 26, 13], ["chair W", 28, 13]],
      people: [
        {
          id: "ev_fs_baker_husband", name: "빵집 아저씨 토마", query: "중년 남성 주민", chip: ["tex_easyrpg_charset_people1", 4], behindCounter: true,
          lines: ["아내는 광장에 나가 있어요. 별이 떨어진 밤엔 반죽이 안 부푼다던데… 미신이겠죠.", "그래도 오늘 새벽 반죽은 정말 안 부풀었어요."],
          after: ["기계 아가씨가 빵을 먹나요? …먹는 흉내라도 낸다면 하나 싸 줄게요."],
        },
      ],
    },
    {
      door: { x: 4, y: 20 }, mapId: "fs_stargazer_home", name: "아스텔 · 늙은 별지기의 집", bgm: "cc0-bgm-rtp-mys-002",
      // 별 지도 서고 + 관측 일지 서재 + 침실 + 지하 저장고 + 벽난로 거실(괘종시계) — 부엌·열 사람 식탁은 두지 않는다(혼자 사는 노인, VQA r6).
      // 지하 저장고 대신 별 유물 진열실(천구의·운석 진열장) — 별지기 집만의 방(VQA r11 major).
      layout: { rooms: [{ kind: "library", w: 18, h: 8 }, { kind: "study", w: 9, h: 7 }, { kind: "bedroom" }, { kind: "museum_relics" }, { kind: "living", w: 8, h: 6 }], seed: 21, variant: 0, styleVariant: "D" },
      dress: [["orrery", 15, 15], ["globe", 13, 12], ["book pile", 18, 12], ["desk 3x1", 22, 16], ["owl perch", 27, 16], ["scroll rack", 13, 16],
        ["desk 2x2", 14, 4], ["book pile", 12, 3],
        // 서고 가운데·거실 아랫단이 빈 마루로 남았다(VQA r7 minor) — 읽는 탁자와 의자, 거실 찻상.
        ["tea 2x2", 17, 15], ["chair E", 16, 15], ["chair W", 19, 15], ["book pile", 22, 14],
        ["tea 2x2", 6, 15], ["chair E", 5, 15], ["chair W", 8, 15],
        // 거실 아랫단·서고 아랫단·진열실 남쪽이 빈 마루였다(VQA r13 minor 「35~40% 빈 바닥」).
        ["tea 2x2", 4, 7], ["chair E", 3, 7], ["chair W", 6, 7], ["globe", 24, 7], ["book pile", 27, 8], ["scroll rack", 16, 8],
        ["tea 2x2", 27, 17], ["chair E", 26, 17], ["chair W", 29, 17], ["book pile", 21, 18],
        // 진열실(왼쪽 아래) — 걷어 낸 갑옷 진열 대신 천구의·지구본·두루마리·관측 책상.
        ["orrery", 3, 14], ["globe", 11, 14], ["scroll rack", 2, 17], ["desk 3x1", 6, 17], ["book pile", 11, 17], ["owl perch", 12, 18]],
      people: [
        {
          id: "ev_fs_old_stargazer", name: "늙은 별지기 오스본", query: "노인 남성", chip: ["tex_easyrpg_charset_people5", 6],
          lines: ["나도 젊을 땐 저 천문대에서 별을 셌지. 하넬 녀석이 내 자리를 물려받았고.", "어젯밤 그 별은 궤도가 이상했어. 떨어진 게 아니라… 내려앉은 것처럼 보였지."],
          after: ["하늘을 건너는 배라… 하넬이 평생 찾던 답이 그 아이 안에 있겠구먼.", "교단은 하늘을 두려워해. 두려운 건 덮으려 들지. 조심하게, 카엘."],
        },
      ],
    },
    {
      door: { x: 32, y: 20 }, mapId: "fs_lisa_home", name: "아스텔 · 리사네 집", bgm: "cc0-bgm-rtp-emo-002",
      // 가족 집: 거실(벽난로) + 식당 + 부엌 + 침실 둘(부부·아이) + 식료품 광 + 헛간 광 + 지하 저장고(흰 도기 욕조는 중세 집에 안 맞았다, VQA r6).
      // 여덟 방(여덟 자리 식탁·식료품 광·헛간·지하 저장고)은 작은 오두막에 안 맞았다(VQA r11 major) — 거실·부엌·침실 둘·바느질 방(리사의 일감).
      layout: { rooms: [{ kind: "living", w: 12, h: 8 }, { kind: "kitchen", w: 8, h: 7 }, { kind: "master_bedroom", w: 8, h: 7 }, { kind: "bedroom", w: 8, h: 7 }, { kind: "tailor_work", w: 9, h: 7 }], seed: 29, variant: 0, styleVariant: "A" },
      // 거실 아랫단·바느질 방 아랫단이 빈 마루였다 — 찻상과 의자, 옷감 상자.
      dress: [["tea 2x2", 16, 14], ["chair E", 15, 14], ["chair W", 18, 14], ["book pile", 20, 15], ["luggage trunk", 5, 15], ["dining 2x1", 3, 13], ["chair S", 3, 12], ["chair N", 4, 14],
        // 침실 둘이 똑같은 그림이고 아랫단이 비었다(VQA r13) — 부부 방엔 찻상, 아이 방엔 짐 궤짝·책 더미.
        ["tea 2x2", 14, 6], ["chair E", 13, 6], ["chair W", 16, 6], ["luggage trunk", 21, 7], ["book pile", 26, 7], ["basket:herb", 25, 7]],
      people: [
        {
          id: "ev_fs_lisa", name: "리사", query: "젊은 여성", chip: ["tex_easyrpg_charset_people3", 3],
          lines: ["심문관 발렌이 왔다면서요. 교단은 그 별을 「불경한 하늘의 물건」이라 부른대요.", "우리 애가 밤새 창밖만 보더라고요. 별이 노래를 부른다나요."],
          after: ["그 은빛 머리 아가씨, 숨기는 게 좋을 거예요. 심문관은 한 번 본 얼굴은 잊지 않는대요."],
        },
      ],
    },
  ];

  const doors = townDoors(project, hub);
  const built: string[] = [];
  for (const home of homes) {
    if (!doors.some((d) => d.x === home.door.x && d.y === home.door.y)) throw new Error(`[fallen-town-interiors] 집 문이 아니다: ${home.name} (${home.door.x},${home.door.y})`);
    const room = run(project, "build_hand_interior_room", { mapId: home.mapId, name: home.name, layout: home.layout });
    const exitsRaw = (room.data as { exits?: { x: number; y: number; width?: number }[] } | undefined)?.exits ?? [];
    const exit = exitsRaw[0];
    if (!exit) throw new Error(`[fallen-town-interiors] ${home.name}: 실내 출구가 없다`);
    const exitCell = { x: exit.x + Math.floor(((exit.width ?? 1) - 1) / 2), y: exit.y };
    run(project, "create_transfer_pair", {
      a: { mapId: hubId, x: home.door.x, y: home.door.y + 1, doorAt: home.door },
      b: { mapId: home.mapId, x: exitCell.x, y: exitCell.y },
    });
    // 문 짝 다듬기(game-scene-polish 2-1·2-3) — 바깥 트리거는 문 그림 칸 위 부딪힘 문, 들어가면 문을 등지고(위) 서고,
    // 나오면 문 바로 앞 칸에 문을 등지고(아래) 선다.
    const front = { x: home.door.x, y: home.door.y + 1 };
    const goesTo = (target: string) => (e: { pages?: unknown }) => JSON.stringify(e).includes(`"mapId":"${target}"`);
    const outer = project.maps[hubId]!.events.find((e) => String(e.id).startsWith("ev_gate_") && goesTo(home.mapId)(e));
    if (!outer) throw new Error(`[fallen-town-interiors] ${home.name}: 바깥 문 이벤트가 없다`);
    outer.x = home.door.x; outer.y = home.door.y;
    for (const page of outer.pages ?? []) {
      page.priority = "same"; (page as { overlapForbidden?: boolean }).overlapForbidden = true;
      for (const cmd of page.commands ?? []) if ((cmd as { kind?: string }).kind === "transfer") (cmd as { direction?: string }).direction = "up";
    }
    for (const e of project.maps[home.mapId]!.events) if (goesTo(hubId)(e)) for (const page of e.pages ?? []) for (const cmd of page.commands ?? []) {
      const t = cmd as { kind?: string; x?: number; y?: number; direction?: string };
      if (t.kind === "transfer") { t.x = front.x; t.y = front.y; t.direction = "down"; }
    }
    // 2칸 발깔개는 1칸 문 틈과 반 칸 어긋나 「문 옆 깔개」로 읽혔다(VQA r4) — 1칸 틈이면 깔개를 걷는다.
    if ((exit.width ?? 1) < 2) {
      const overlay = project.maps[home.mapId]!.lowerOverlayTiles;
      if (overlay) for (let i = 0; i < overlay.length; i += 1) if (overlay[i] === 3964 || overlay[i] === 3965) overlay[i] = -1;
    }
    run(project, "set_map_properties", { mapId: home.mapId, bgm: { mode: "custom", resourceId: home.bgm } });
    // 약방 뒷방의 나선 계단(어디로도 안 가고 시점이 달랐다)·마법진, 바닥에 누운 망원경은 걷는다(VQA r13 minor).
    {
      const im = project.maps[home.mapId]!;
      const metaX = (project.tilesets[im.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
      const drop = home.mapId === "fs_stargazer_home"
        // 진열실의 갑옷·투구·왕관·검 진열은 무기고·박물관으로 읽혔다(VQA r16) — 별 유물(천구의·별 지도)만 남긴다.
        ? /^(나선 계단|마법진|망원경|검 유리 진열장|왕관 받침|받침대 위 고대 투구|청동 원형 방패 걸이|장신구 진열장)/
        : /^(나선 계단|마법진|망원경)/;
      for (const layer of [im.lowerOverlayTiles, im.upperTiles, im.upperOverlayTiles]) {
        if (!layer) continue;
        for (let i = 0; i < layer.length; i += 1) if (layer[i]! >= 0 && drop.test(metaX[layer[i]!]?.label ?? "")) layer[i] = -1;
      }
    }
    for (const [kit, x, y] of home.dress ?? []) {
      const ctx = { project, assistantRun: false };
      try {
        // 방 배치가 바뀌면 고정 좌표 가구가 벽 너머 어둠(천장·허공)에 찍혔다(VQA r12 major, 약방 바구니·별지기 침실 찻상) —
        // 찍힌 칸 가운데 하나라도 바닥이 아니면 되돌린다.
        const before = project.maps[home.mapId]!;
        const snap = { upper: [...before.upperTiles], lowerOverlay: before.lowerOverlayTiles ? [...before.lowerOverlayTiles] : undefined, upperOverlay: before.upperOverlayTiles ? [...before.upperOverlayTiles] : undefined };
        const res = runTool(ctx, "stamp_object", { objectId: `kit:atlas_biome_interior/hand-interior:${kit}`, mapId: home.mapId, x, y }, { dryRun: false }) as Run;
        if (res.ok) {
          const after = ctx.project.maps[home.mapId]!;
          const metaD = (ctx.project.tilesets[after.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
          const changed: number[] = [];
          after.upperTiles.forEach((t, i) => { if (t !== snap.upper[i]) changed.push(i); });
          after.lowerOverlayTiles?.forEach((t, i) => { if (snap.lowerOverlay && t !== snap.lowerOverlay[i]) changed.push(i); });
          after.upperOverlayTiles?.forEach((t, i) => { if (snap.upperOverlay && t !== snap.upperOverlay[i]) changed.push(i); });
          const onFloor = changed.every((i) => (metaD[after.lowerTiles[i]!]?.label ?? "").startsWith("바닥"));
          if (onFloor) Object.assign(project, ctx.project);
          else {
            after.upperTiles.splice(0, after.upperTiles.length, ...snap.upper);
            if (snap.lowerOverlay && after.lowerOverlayTiles) after.lowerOverlayTiles.splice(0, after.lowerOverlayTiles.length, ...snap.lowerOverlay);
            if (snap.upperOverlay && after.upperOverlayTiles) after.upperOverlayTiles.splice(0, after.upperOverlayTiles.length, ...snap.upperOverlay);
          }
        }
      } catch { /* 장식 — 못 놓으면 건너뛴다 */ }
    }
    // 부엌의 수도꼭지 개수대·쇠 레인지는 중세 집에 어울리지 않았고 세 집에 똑같이 깔렸다(VQA r5) — 물동이와 화덕·조리대로 바꾼다.
    periodKitchen(project.maps[home.mapId]!);
    // 출구 바로 앞(두 칸 안)의 모피 깔개는 들어오자마자 주인공 뒤에 자루처럼 놓였다(VQA r9 minor) — 걷는다.
    {
      const im = project.maps[home.mapId]!;
      const metaI = (project.tilesets[im.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
      for (const layer of [im.lowerOverlayTiles, im.upperTiles]) {
        if (!layer) continue;
        const rug = (i: number): boolean => i >= 0 && i < layer.length && /모피 깔개/.test(metaI[layer[i]!]?.label ?? "");
        const queue: number[] = [];
        for (let i = 0; i < layer.length; i += 1) {
          const x = i % im.width, y = Math.floor(i / im.width);
          if (Math.abs(x - exitCell.x) <= 2 && exitCell.y - y <= 2 && exitCell.y - y >= 0 && rug(i)) queue.push(i);
        }
        // 깔개 한 장을 통째로 — 붙은 깔개 칸까지 걷는다.
        while (queue.length) {
          const i = queue.pop()!;
          if (!rug(i)) continue;
          layer[i] = -1;
          queue.push(i - 1, i + 1, i - im.width, i + im.width);
        }
      }
    }
    const interior = project.maps[home.mapId]!;
    // 사람은 출구에서 걸어 닿는 방 안쪽 빈 칸에 — 출구·서로 3칸 이상 떨어지게. 가게 주인은 계산대 뒤에.
    const taken: Cell[] = [exitCell];
    for (const [k, person] of home.people.entries()) {
      const counter = person.behindCounter ? counterSpot(project, interior, exitCell) : undefined;
      const spot = counter?.behind ?? farFreeCell(project, interior, exitCell, taken, k === 0 ? 0.45 : 0.8);
      if (!spot) throw new Error(`[fallen-town-interiors] ${home.name}: ${person.name} 이 설 칸이 없다`);
      taken.push(spot);
      run(project, "place_npc", {
        mapId: home.mapId, x: spot.x, y: spot.y, id: person.id, name: person.name, graphic: { query: person.query },
        pages: [
          { name: `${person.name} · 기본`, lines: person.lines, commands: person.commands ?? [] },
          { name: `${person.name} · 이리스 합류 뒤`, conditions: after(ids.irisJoined), lines: person.after, commands: person.commands ?? [] },
        ],
      });
      const live = project.maps[home.mapId]!;
      const npc = live.events.find((e) => e.id === person.id);
      if (!npc) continue;
      // place_npc 는 가구 곁 칸을 피해 옆으로 비켜 세운다 — 계산대 뒤 자리는 일부러 고른 칸이라 그대로 둔다.
      if (counter) { npc.x = counter.behind.x; npc.y = counter.behind.y; }
      // 이름 있는 사람마다 다른 칩 — 같은 낱말(노인 남성·젊은 여성)로 고르면 두 집에 같은 얼굴이 섰다(VQA r5).
      for (const page of npc.pages ?? []) {
        if (!page.graphic?.sprite) continue;
        const direction = counter ? "down" : page.graphic.direction ?? "down";
        page.graphic = { ...page.graphic, sprite: { type: "bundled", id: person.chip[0] }, direction, pattern: charsetFrameIndex({ characterIndex: person.chip[1], direction, pattern: 1 }) };
        if (counter) page.movement = { type: "fixed", speed: 3, frequency: 3 };
      }
      if (counter) {
        // 계산대 칸에 투명한 대리 이벤트 — 손님이 계산대를 보고 말을 걸면 주인의 대사·가게가 열린다.
        const proxy = JSON.parse(JSON.stringify(npc)) as typeof npc;
        proxy.id = `${person.id}_counter`; proxy.name = `${person.name}(계산대)`; proxy.x = counter.counter.x; proxy.y = counter.counter.y;
        for (const page of proxy.pages ?? []) {
          page.id = `${page.id}_counter`;
          page.graphic = { transparent: true } as typeof page.graphic;
          page.priority = "same";
          page.movement = { type: "fixed", speed: 3, frequency: 3 };
        }
        live.events.push(proxy);
      }
    }
    built.push(home.mapId);
  }

  dressShopFronts(project, hubId, homes);

  // 들어가지 않는 문 — 부딪히면 잠겼다고 말한다(가짜 문 금지).
  const LOCKED = [
    "문이 굳게 잠겨 있다. 안에서는 아무 대답이 없다.",
    "문이 잠겨 있다. 창틈으로 빵 굽는 냄새만 새어 나온다.",
    "문이 잠겨 있다. 「교단 행렬이 지나갈 때까지 문을 열지 마시오」라는 쪽지가 붙어 있다.",
  ];
  const locked: Cell[] = [];
  // 도구를 부를 때마다 맵 객체가 새로 만들어진다 — 앞에서 잡은 hub 가 아니라 지금 맵에 단다.
  const liveHub = project.maps[hubId]!;
  for (const d of doors) {
    if (homes.some((h) => h.door.x === d.x && h.door.y === d.y)) continue;
    if (liveHub.events.some((e) => e.x === d.x && e.y === d.y)) continue;
    const body = LOCKED[(d.x + d.y) % LOCKED.length]!;
    liveHub.events.push({
      id: `ev_fs_locked_${d.x}_${d.y}`, name: "잠긴 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `ev_fs_locked_${d.x}_${d.y}_page`, name: "잠김", conditions: [], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [{ kind: "text", body, context: "narration", position: "bottom" }],
      }],
    } as unknown as GameMap["events"][number]);
    locked.push(d);
  }
  return { built, locked };
}

/** origin 에서 걸어 닿는 칸 가운데 rank(0 가까움 ~ 1 멂) 자리 — 다른 칸·이벤트와 2칸 넘게 떨어진 곳. */
function farFreeCell(project: Project, map: GameMap, origin: Cell, taken: readonly Cell[], rank: number): Cell | undefined {
  const tileset = project.tilesets[map.tilesetId]!;
  const passable = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
    const i = y * map.width + x;
    for (const t of [map.lowerTiles[i], map.lowerOverlayTiles?.[i], map.upperTiles[i], map.upperOverlayTiles?.[i]]) {
      if (t === undefined || t < 0) continue;
      const p = tileset.passability[t];
      if (p && !p.up && !p.down && !p.left && !p.right) return false;
    }
    return true;
  };
  const dist = new Map<string, number>([[`${origin.x},${origin.y}`, 0]]);
  const queue = [origin];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }, k = `${n.x},${n.y}`;
      if (dist.has(k) || !passable(n.x, n.y)) continue;
      dist.set(k, dist.get(`${c.x},${c.y}`)! + 1);
      queue.push(n);
    }
  }
  const near = (c: Cell, d: number) => [...taken, ...map.events].some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= d);
  const cells = [...dist.entries()].map(([k, d]) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y!, d }; })
    .filter((c) => c.d >= 3 && !near(c, 2)
      // 사람 둘레 네 칸 중 셋 이상이 걸을 수 있어야 한다(가구 틈에 끼지 않게).
      && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => dist.has(`${c.x + dx!},${c.y + dy!}`)).length >= 3
      // 방 사이 문틈(좌우가 벽인 칸)과 그 앞뒤 칸에는 세우지 않는다 — 리사가 침실 문간을 막고 섰다(VQA r15 minor).
      && ![[0, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = c.x + dx!, y = c.y + dy!; return dist.has(`${x},${y}`) && !passable(x - 1, y) && !passable(x + 1, y); }))
    .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  if (!cells.length) return undefined;
  const c = cells[Math.min(cells.length - 1, Math.round(rank * (cells.length - 1)))]!;
  return { x: c.x, y: c.y };
}

/** 수도꼭지 개수대 → 물동이, 쇠 레인지(2×3) → 화덕 + 조리대(위 줄은 비운다). 칸 번호만 바꾼다(새 그림 없음). */
function periodKitchen(map: GameMap): void {
  const swap: Record<number, number> = { 3697: -1, 3698: 7142, 4125: -1, 4126: -1, 4127: 3936, 4128: 4064, 4140: 3948, 4152: 4065 };
  // 저장고의 「무너진 벽돌」 벽면(3228~3243)은 붉고 보랏빛 얼룩이 번진 낮은 해상도처럼 보였다(VQA r6 major) — 같은 짜임(16칸)의
  // 「짙은 통나무」 벽면(3098~3113)으로 바꾼다.
  for (let t = 3228; t <= 3243; t += 1) swap[t] = t - 3228 + 3098;
  // 부엌의 흰 「부엌 타일」 바닥·벽(1126~1189, 3030~3033)은 현대 주방처럼 보였다(VQA r6 minor) — 같은 짜임의
  // 「자갈」 바닥(454~517)과 「통나무」 벽면(3094~3097)으로 바꿔 옛 시골 부엌으로 맞춘다.
  for (let t = 1126; t <= 1189; t += 1) swap[t] = t - 1126 + 454;
  for (let t = 3030; t <= 3033; t += 1) swap[t] = t - 3030 + 3094;
  for (const layer of [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles]) {
    if (!layer) continue;
    for (let i = 0; i < layer.length; i += 1) { const to = swap[layer[i]!]; if (to !== undefined) layer[i] = to; }
  }
}

/** 출구에서 걸어 닿는 계산대 칸 바로 북쪽(계산대 뒤)의 빈 칸 — 남쪽(손님 쪽)은 걸어 닿아야 한다. */
function counterSpot(project: Project, map: GameMap, exit: Cell): { counter: Cell; behind: Cell } | undefined {
  const ts = project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[]; passability: Record<number, { up?: boolean; down?: boolean; left?: boolean; right?: boolean } | undefined> };
  const meta = ts.tileMeta ?? [];
  const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles];
  const at = (x: number, y: number): number[] => layers.map((l) => l?.[y * map.width + x] ?? -1).filter((t) => t >= 0);
  const passable = (x: number, y: number): boolean => x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1
    && at(x, y).every((t) => { const p = ts.passability[t]; return !p || p.up || p.down || p.left || p.right; })
    && !map.events.some((e) => e.x === x && e.y === y);
  const isCounter = (x: number, y: number): boolean => at(x, y).some((t) => /카운터|계산대|판매대/.test(meta[t]?.label ?? "") && !/조리대/.test(meta[t]?.label ?? ""));
  const reach = new Set<string>([`${exit.x},${exit.y}`]);
  const queue = [exit];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }, k = `${n.x},${n.y}`;
      if (reach.has(k) || !passable(n.x, n.y)) continue;
      reach.add(k); queue.push(n);
    }
  }
  const options: { counter: Cell; behind: Cell; d: number }[] = [];
  for (let y = 1; y < map.height - 2; y += 1) for (let x = 1; x < map.width - 1; x += 1) {
    if (!isCounter(x, y) || !passable(x, y - 1) || !reach.has(`${x},${y + 1}`)) continue;
    options.push({ counter: { x, y }, behind: { x, y: y - 1 }, d: Math.abs(x - exit.x) + Math.abs(y - exit.y) });
  }
  // 손님이 계산대 앞에 서 볼 수 있게 출구에서 가까운 계산대 — 뒤 칸이 손님 쪽과 이어져 있지 않은(진짜 계산대 뒤) 자리를 먼저.
  options.sort((p, q) => Number(reach.has(`${p.behind.x},${p.behind.y}`)) - Number(reach.has(`${q.behind.x},${q.behind.y}`)) || p.d - q.d);
  return options[0];
}

/**
 * 가게 앞 — 여관·약방·빵집이 바깥에서 그냥 집으로 보였고, 늙은 별지기의 집만 간판·차양을 달아 가게로 읽혔다(VQA r6 major).
 * 가게 문 옆 벽에 걸이 간판을 걸고, 문 곁 풀밭에 쓰임을 말하는 버들항 소품(주막 탁자·약초 말리는 틀·빵 진열대·입간판)을 둔다.
 * 별지기의 집은 같은 집 키트의 민짜 벽(문 오른쪽 두 칸)으로 간판·차양을 걷는다. 새 그림 없음(버들항 키트·칸 번호만).
 */
function dressShopFronts(project: Project, hubId: string, homes: readonly Home[]): void {
  const FRONT: Record<string, readonly string[]> = {
    fs_inn: ["bd-prop-table_mugs", "bd-prop-sandwich_board"],
    fs_apothecary: ["bd-pick-wizard-tower-herb-rack", "bd-prop-sandwich_board"],
    fs_bakery_home: ["bd-prop-bread_rack", "bd-prop-sandwich_board"],
  };
  const HANGING_SIGN = 23605;
  for (const home of homes) {
    const hub = project.maps[hubId]!;
    const { door } = home;
    const at = (x: number, y: number): number => y * hub.width + x;
    if (home.mapId === "fs_stargazer_home") {
      // 처마 간판 걸이(5457·5459) → 민짜 처마(757·826), 걸이 간판 벽(5745·5747) → 버팀대 벽(5831·5742), 차양 진열창(6046) → 버팀대 아랫벽(6041).
      // 문 왼쪽 벽과 같은 반쪽 목조 벽 칸만 쓴다(같은 집 키트, 새 그림 없음).
      const plain: Record<number, number> = { 5457: 757, 5459: 826, 5745: 5831, 5747: 5742, 6046: 6041 };
      for (let y = door.y - 2; y <= door.y; y += 1) for (let x = door.x + 1; x <= door.x + 2; x += 1) {
        const to = plain[hub.upperTiles[at(x, y)]!];
        if (to !== undefined) hub.upperTiles[at(x, y)] = to;
      }
      continue;
    }
    const kits = FRONT[home.mapId];
    if (!kits) continue;
    // 걸이 간판 — 문 오른쪽 벽(문 윗줄). 덧그림 층(upperOverlay)이라 벽 그림 위에 걸린다.
    const overlay = hub.upperOverlayTiles ?? (hub.upperOverlayTiles = new Array(hub.width * hub.height).fill(-1));
    const signAt = at(door.x + 1, door.y - 1);
    if ((overlay[signAt] ?? -1) < 0) overlay[signAt] = HANGING_SIGN;
    const tileset = project.tilesets[hub.tilesetId]!;
    const free = (x: number, y: number): boolean => {
      if (x < 1 || y < 1 || x >= hub.width - 1 || y >= hub.height - 1) return false;
      if (Math.abs(x - door.x) <= 1 && y >= door.y && y <= door.y + 2) return false; // 문 앞 길은 비운다
      const i = at(x, y);
      for (const t of [hub.lowerTiles[i], hub.lowerOverlayTiles?.[i], hub.upperTiles[i], hub.upperOverlayTiles?.[i]]) {
        if (t === undefined || t < 0) continue;
        const pass = tileset.passability[t];
        if (pass && !pass.up && !pass.down && !pass.left && !pass.right) return false;
        if (/길|포석|광장|road|plaza/i.test(tileset.tileMeta?.[t]?.label ?? "")) return false; // 길을 막지 않는다
      }
      return !hub.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
    };
    const taken = new Set<string>();
    for (const kitId of kits) {
      const kit = tileset.structureKits?.find((k) => k.id === kitId);
      if (!kit) continue;
      const spots: Cell[] = [];
      for (let r = 2; r <= 5; r += 1) for (const dx of [-r, r, -r + 1, r - 1]) for (const dy of [0, 1, -1, 2]) spots.push({ x: door.x + dx, y: door.y + dy - (kit.height - 1) });
      const spot = spots.find((s) => {
        for (let ky = 0; ky < kit.height; ky += 1) for (let kx = 0; kx < kit.width; kx += 1) if (!free(s.x + kx, s.y + ky) || taken.has(`${s.x + kx},${s.y + ky}`)) return false;
        return true;
      });
      if (!spot) continue;
      try {
        run(project, "stamp_object", { objectId: `kit:${hub.tilesetId}/${kitId}`, mapId: hubId, x: spot.x, y: spot.y });
        for (let ky = -1; ky <= kit.height; ky += 1) for (let kx = -1; kx <= kit.width; kx += 1) taken.add(`${spot.x + kx},${spot.y + ky}`);
      } catch { /* 장식 — 못 놓으면 건너뛴다 */ }
    }
  }
}
