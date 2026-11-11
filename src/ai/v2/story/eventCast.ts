// 컷신에 나오는 사람 — 주인공인지 가리기, 얼굴 그림, 이름으로 NPC 찾기, 장면 뒤 한마디(defaultFollowUp), NPC 대화 끝 선택지(afterPageChoice), 고르는 말 명령(chooseCommand).
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { startStateOf } from "@/project/session";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { eventsOf } from "../place/cells";
import type { EventBeat } from "../shared/types";

const HERO = /^(주인공|플레이어|용사|player|hero|protagonist)$/i;

/** after 장면을 NPC 대화 끝에 이을 때 앞에 두는 표(라벨 명령, 런타임에서는 아무것도 안 한다) — 다시 이을 때 여기서 잘라 바꾼다. */
export const AFTER_SCENE_LABEL = "v2-after-scene";

export function isHero(who: string | undefined): boolean {
  return HERO.test(String(who ?? "").trim());
}

/** 주인공(파티 맨 앞) 칩 — 그림 틀에 주인공을 그린다. */
export function leaderCharset(project: Project): { textureKey: string; characterIndex: number } | undefined {
  const sys = project.system as unknown as { startActorIds?: string[] };
  const actors = ((project.database as unknown as { actors?: { id: string; characterResourceId?: string; characterIndex?: number }[] }).actors) ?? [];
  const leader = actors.find((a) => a.id === sys.startActorIds?.[0]) ?? actors[0];
  const id = leader?.characterResourceId;
  const textureKey = id ? findCharsetAsset(id)?.textureKey : undefined;
  return textureKey ? { textureKey, characterIndex: leader?.characterIndex ?? 0 } : undefined;
}

export function npcFace(map: GameMap, eventId: string): string | undefined {
  const ev = (map.events ?? []).find((e) => e.id === eventId);
  for (const c of ev?.pages?.[0]?.commands ?? []) if ((c as { kind?: string }).kind === "changeFace") return (c as { resourceId?: string }).resourceId || undefined;
  return undefined;
}

export function heroFace(project: Project): string | undefined {
  const lead = startStateOf(project).partyActorIds[0];
  const actor = lead ? project.database.actors.find((a) => a.id === lead) : undefined;
  return actor?.faceResourceId || undefined;
}

/** 역할로 정한 «컷신 뒤 말 걸면» 한 줄(appear.talk 이 없을 때). */
export function defaultFollowUp(name: string, looks: string | undefined): string[] {
  const t = `${name} ${looks ?? ""}`;
  if (/촌장|이장|장로|원로|elder|chief|mayor/i.test(t)) return ["마을을 천천히 둘러보게나. 궁금한 게 있으면 언제든 날 찾아오고."];
  if (/경비|문지기|병사|guard|soldier/i.test(t)) return ["수상한 자가 보이면 바로 알려 주게."];
  if (/상인|점원|주인|merchant|shop/i.test(t)) return ["필요한 게 있으면 들르게나."];
  return ["또 보세."];
}

export function findNpcByName(map: GameMap, name: string): GameEvent | undefined {
  const want = name.trim().toLowerCase();
  return eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === want);
}

/** after NPC 의 어느 페이지에 장면을 이을지. 말 걸기 페이지가 여럿인데 afterPage 가 없으면 problem(페이지 목록). */
export function afterPageChoice(npc: GameEvent, afterPage: number | undefined): { pick?: number; problem?: string } {
  const all = npc.pages ?? [];
  // 앞서 이 사람에게 이은 장면(라벨 표)이 있으면 그 페이지를 다시 고른다. 장면이 만든 「장면 뒤」 페이지는 고를 거리에서 뺀다.
  const ownAfter = (pg: (typeof all)[number]): boolean => /\(장면 뒤\)$/u.test(String(pg.name ?? "")) && (pg.conditions ?? []).some((c) => (c as { kind?: string; key?: string }).kind === "selfSwitch" && (c as { key?: string }).key === "D");
  const talkIdx = all.map((pg, i) => ({ pg, i })).filter(({ pg }) => { const k = (pg.trigger as { kind?: string } | undefined)?.kind; return (k === undefined || k === "action") && !ownAfter(pg); }).map(({ i }) => i);
  if (typeof afterPage === "number" && all[afterPage] && !ownAfter(all[afterPage]!)) return { pick: afterPage };
  const marked = all.findIndex((pg) => (pg.commands ?? []).some((c) => (c as { kind?: string; name?: string }).kind === "label" && (c as { name?: string }).name === AFTER_SCENE_LABEL));
  if (marked >= 0) return { pick: marked };
  if (talkIdx.length <= 1) return { pick: talkIdx[0] ?? 0 };
  const list = talkIdx.map((i) => {
    const pg = all[i]!;
    const cond = (pg.conditions ?? []).map((c) => { const o = c as { kind?: string; switchId?: string; key?: string; value?: unknown }; return o.kind === "switch" ? `${o.switchId}=${o.value === false ? "꺼짐" : "켜짐"}` : o.kind === "selfSwitch" ? `셀프 ${o.key}` : String(o.kind); }).join(",") || "조건 없음";
    const line = (pg.commands ?? []).map((c) => (c as { body?: string; text?: string }).body ?? (c as { text?: string }).text).find((t) => typeof t === "string");
    return `${i}) ${cond} «${String(line ?? "").slice(0, 24)}»`;
  }).join(" / ");
  return { problem: `after: '${npc.name}' 은 말 걸기 페이지가 ${talkIdx.length}개다 — 장면이 일어나는 페이지를 afterPage 로 골라 add_event 를 다시 부른다(장면은 만들지 않았다): ${list}` };
}

export const CHOOSE_LABEL = "v2-choose-";

/** choose 비트 → choices 명령. 갈래: 대답 대사 + 돈(모자라면 «모자란다»로 끝) + 물건. 취소는 막는다(흥정 도중 빠져나가 결과가 없는 길을 없앤다). */
export function chooseCommand(project: Project, b: Extract<EventBeat, { do: "choose" }>, warnings: string[], faceFor: (who: string) => string | undefined): Command[] {
  const who = String(b.who ?? "").trim();
  // 갈래 대사마다 말하는 사람 얼굴을 다시 건다 — 선택 앞 마지막 얼굴(주인공)이 상인 대답에 남아 있었다(시연 캡처 2026-10-31).
  const lineCmd = (raw: string): Command[] => {
    const m = /^([^:：]{1,12})[:：]\s*(.+)$/u.exec(raw.trim());
    const speaker = m ? m[1]!.trim() : who;
    const body = m ? m[2]!.trim() : raw.trim();
    const face = faceFor(speaker);
    return [{ kind: "changeFace", resourceId: face ?? "", position: "left", flipHorizontally: false } as unknown as Command,
      (isHero(speaker) || !speaker ? { kind: "text", body } : { kind: "text", speaker, body }) as Command];
  };
  const items = (project.database.items ?? []) as unknown as { id: string; name?: string }[];
  const options = b.options.filter((o) => String(o?.label ?? "").trim()).slice(0, 4).map((o) => {
    const said = (o.lines ?? []).map((l) => String(l).trim()).filter(Boolean).flatMap(lineCmd);
    const gain: Command[] = [];
    if (o.item) {
      const want = String(o.item).trim();
      const it = items.find((x) => String(x.name ?? "").trim() === want) ?? items.find((x) => x.id === want) ?? items.find((x) => want && String(x.name ?? "").includes(want));
      if (it) gain.push({ kind: "changeItem", itemId: it.id, op: "+=", amount: Math.max(1, Math.round(o.count ?? 1)) } as unknown as Command);
      else warnings.push(`choose: 물건 '${want}' 이 DB 아이템에 없어 그 갈래에서 뺐다(있는 이름: ${items.slice(0, 8).map((x) => x.name).join(", ")}).`);
    }
    const gold = Math.round(Number(o.gold ?? 0));
    let branch: Command[];
    if (gold < 0) {
      const pay = { kind: "changeGold", op: "-=", amount: -gold } as unknown as Command;
      branch = [{ kind: "fork", condition: { kind: "gold", op: ">=", amount: -gold }, then: [pay, ...gain, ...said],
        else: lineCmd(`${who ? `${who}: ` : ""}돈이 모자라는군. ${-gold}G 는 있어야 해.`) } as unknown as Command];
    } else branch = [...(gold > 0 ? [{ kind: "changeGold", op: "+=", amount: gold } as unknown as Command] : []), ...gain, ...said];
    return { text: String(o.label).trim().slice(0, 40), branch };
  });
  // 묻는 말(text)은 그 사람의 대사로 선택지 바로 앞에 띄운다(choices.prompt 는 이름·얼굴 없이 떠서 누가 묻는지 안 보였다).
  return [...(b.text ? lineCmd(String(b.text)) : []), { kind: "choices", options, cancelBehavior: "disallow" } as unknown as Command];
}
