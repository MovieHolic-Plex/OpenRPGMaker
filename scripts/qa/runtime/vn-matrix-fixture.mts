// 런타임 QA 입력: 미연시 대사창 레이아웃 전 조합 매트릭스(창 위치 × 흉상 × 이름 × 글 길이 × 선택지).
//   bun scripts/qa/runtime/vn-matrix-fixture.mts <outDir> <profile: full|small|en|ja|zh> [vnLookJson]
// 한 NPC 가 한 번의 대화에서 모든 조합을 차례로 말한다(줄 앞의 [번호] 가 캡처의 신원표). 출력: project.json, proof.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../../src/editor/newProjectChoices.ts";
import { normalizeGameDesignBrief } from "../../../src/project/gameDesignBrief.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { applyRomanceDefaults } from "../../../src/project/romancePreset.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { mergeDialogueSystem, resolveDialogueSystem } from "../../../src/project/dialogueSystem.ts";
import { withVerifiedPlayableSegment } from "../../../src/project/playableSegment.ts";
import type { Project } from "../../../src/project/types.ts";

const [outDir, profile = "full", vnLookJson] = process.argv.slice(2) as [string, string?, string?];
mkdirSync(outDir, { recursive: true });
const language = profile === "en" || profile === "ja" || profile === "zh" ? profile : "ko";
const input = JSON.parse(readFileSync("scripts/qa-game/briefs/campus-reunion-romance.json", "utf8"));
const choice = newProjectChoiceById(input.presetId)!;
const seed = createNewProjectSeed(choice.packId, "봄의 교정");
seed.gameDesignBrief = normalizeGameDesignBrief({ ...input.brief, version: 1, presetId: input.presetId });
const raw = deserialize(serialize(seed)) as Project;
const project = (withVerifiedPlayableSegment(raw) ?? raw) as Project;
const applied = applyRomanceDefaults(project);
const ctx = { project, assistantRun: true } as never;
const map = project.maps[project.startMapId]!;
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map.width + x;
const prev = new Map<number, { from: number; dir: string; d: number }>();
const queue = [key(project.startPos.x, project.startPos.y)];
prev.set(queue[0]!, { from: -1, dir: "", d: 0 });
for (let head = 0; head < queue.length; head++) {
  const cell = queue[head]!; const cx = cell % map.width, cy = Math.floor(cell / map.width);
  for (const [dir, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y))) continue;
    if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y)) continue;
    prev.set(key(x, y), { from: cell, dir, d: prev.get(cell)!.d + 1 }); queue.push(key(x, y));
  }
}
const far = [...prev.entries()].filter(([, v]) => v.d >= 3).sort((a, b) => a[1].d - b[1].d)[0]![0];
const npcCell = { x: far % map.width, y: Math.floor(far / map.width) };

const BODY: Record<string, Record<string, string>> = {
  ko: {
    l1: "응, 괜찮아.",
    l3: "어, 그 책… 나도 그 작가 좋아하는데. 도서관 동아리에서 같이 읽어 본 적도 있고, 마지막 장은 아직도 기억에 남아. 너는 어느 장면이 제일 좋았어?",
    l6: "사실은 오늘 아침부터 계속 이 앞을 서성였어. 말을 걸 용기가 안 나서. 그런데 네가 먼저 책을 펼치고 있길래, 이건 기회다 싶었지. 혹시 괜찮다면 같이 한 줄만 읽어 줄래? 아니, 한 줄이 아니라 한 장도 좋아. 어차피 오늘은 수업도 일찍 끝났고, 도서관은 문 닫을 때까지 조용할 테니까.",
    max: "있잖아, 처음 이 캠퍼스에 왔을 때 나는 정말 아무도 몰랐어. 입학식 날 혼자 벤치에 앉아서 점심을 먹는데, 어떤 애가 말도 없이 옆에 앉아서 책만 읽더라. 그게 너였어. 그때는 그냥 이상한 애라고 생각했는데, 지금은 그 조용한 시간이 제일 그리워. 시험 기간에 밤새 같이 도서관에 남아 있던 일, 비 오는 날 우산 하나로 둘이 걸어 내려가던 길, 축제 마지막 날 옥상에서 본 불꽃놀이까지. 하나하나 다 기억나. 그러니까 오늘은 내가 먼저 말할게. 사실 나, 너한테 계속 하고 싶은 말이 있었어. 이 말을 하면 우리 사이가 달라질까 봐 무서웠는데, 더는 미루고 싶지 않아.",
  },
  en: {
    l1: "Yeah, I'm fine.",
    l3: "Oh, that book... I like that author too. We even read it together once in the library club, and I still remember the last chapter. Which scene was your favorite?",
    l6: "Honestly, I have been pacing around out here since this morning, too nervous to talk to you. But then you opened that book first, and I thought, this is my chance. If it is alright, would you read a single line with me? No, not just one line. A whole chapter is fine too. Classes ended early today, and the library will stay quiet until closing time anyway.",
    max: "You know, when I first came to this campus I did not know a single soul. On the day of the entrance ceremony I was eating lunch alone on a bench when someone sat down next to me without a word and just read a book. That was you. Back then I thought you were a strange kid, but now that quiet time is what I miss the most. Staying up all night at the library during exams, walking down the hill under one umbrella on a rainy day, watching the fireworks from the rooftop on the last night of the festival. I remember every bit of it. So today, let me be the one to speak first. The truth is, there is something I have wanted to tell you for a long time. I was afraid it would change what we have, but I do not want to put it off any longer.",
  },
  ja: {
    l1: "うん、大丈夫。",
    l3: "あ、その本…私もその作家が好きなの。図書館のサークルで一緒に読んだこともあるし、最後の章は今でも覚えてる。あなたはどの場面が一番好きだった？",
    l6: "実は今朝からずっとこの前をうろうろしてたの。声をかける勇気が出なくて。でも、あなたが先に本を開いていたから、これはチャンスだと思って。もしよかったら、一行だけ一緒に読んでくれない？ううん、一行じゃなくて一章でもいいよ。どうせ今日は授業も早く終わったし、図書館は閉まるまで静かだから。",
    max: "あのね、初めてこのキャンパスに来た時、私は本当に誰も知らなかったの。入学式の日にひとりでベンチでお昼を食べていたら、誰かが何も言わずに隣に座って、ただ本を読んでいた。それがあなただった。その時はただの変な人だと思っていたけど、今はあの静かな時間が一番恋しい。試験期間に夜通し図書館に残っていたこと、雨の日にひとつの傘で坂道を下ったこと、学園祭の最終日に屋上で見た花火まで。ひとつひとつ全部覚えてる。だから今日は私から話すね。実はずっとあなたに言いたいことがあったの。この言葉を言ったら私たちの関係が変わってしまいそうで怖かったけど、もう先延ばしにしたくない。",
  },
  zh: {
    l1: "嗯，没关系。",
    l3: "咦，那本书……我也喜欢那位作家。在图书馆社团里还一起读过，最后一章到现在我都还记得。你最喜欢哪一幕？",
    l6: "其实我从今天早上就一直在这附近徘徊，没有勇气跟你搭话。可是你先翻开了书，我就想，这是个机会。如果可以的话，能和我一起读一行吗？不，不止一行，一整章也行。反正今天课结束得早，图书馆到关门前都很安静。",
    max: "你知道吗，刚来这个校园的时候，我一个人都不认识。入学典礼那天我一个人坐在长椅上吃午饭，有个人一句话也没说就坐到旁边看书。那个人就是你。当时我只觉得你是个怪人，可现在最怀念的就是那段安静的时光。考试周一起在图书馆熬夜，下雨天共撑一把伞走下坡路，校庆最后一天在天台上看的烟花。每一件我都记得。所以今天让我先开口吧。其实我一直有话想对你说。我怕说出来我们的关系就会改变，可是我不想再拖下去了。",
  },
};
const LENGTH_LABEL: Record<string, string> = { l1: "1줄", l3: "3줄", l6: "6줄", max: "최대(여러 쪽)" };
const NAME = language === "ko" ? "서수현" : language === "en" ? "Suhyun" : language === "ja" ? "スヒョン" : "秀贤";
const CHOICES: Record<string, string[]> = {
  ko: ["같이 읽어 볼래요?", "그냥 지나가던 길이에요.", "조금 더 생각해 보고 싶어요. 오늘은 마음이 복잡해서요."],
  en: ["Shall we read it together?", "I was just passing by.", "I want to think a bit more. My mind is a mess today."],
  ja: ["一緒に読んでみる？", "ただ通りかかっただけです。", "もう少し考えたいです。今日は気持ちが複雑で。"],
  zh: ["要一起读吗？", "我只是路过。", "我想再想想。今天心里有点乱。"],
};
const CHOICE_PROMPT: Record<string, string> = { ko: "어떻게 할래?", en: "What will you do?", ja: "どうする？", zh: "你打算怎么做？" };

type Group = { id: string; label: string; face: { resourceId: string; presentation?: string; position: "left" | "right" } | null };
const BUST = "shared-modern-uni-girl-twintail-expressions-bust-base";
const FULL = "shared-modern-uni-girl-twintail-expressions-full-base";
const FACE48 = "easyrpg-faceset-actor1-02";
const GROUPS: Record<string, Group> = {
  none: { id: "none", label: "흉상 없음", face: null },
  bustL: { id: "bustL", label: "흉상 왼쪽", face: { resourceId: BUST, position: "left" } },
  bustR: { id: "bustR", label: "흉상 오른쪽", face: { resourceId: BUST, position: "right" } },
  faceL: { id: "faceL", label: "48px 얼굴 왼쪽", face: { resourceId: FACE48, presentation: "face", position: "left" } },
  faceR: { id: "faceR", label: "48px 얼굴 오른쪽", face: { resourceId: FACE48, presentation: "face", position: "right" } },
  fullL: { id: "fullL", label: "전신 왼쪽", face: { resourceId: FULL, position: "left" } },
  fullR: { id: "fullR", label: "전신 오른쪽", face: { resourceId: FULL, position: "right" } },
};
type Plan = { groups: { g: keyof typeof GROUPS; positions: string[]; names: boolean[]; lens: string[]; choices: boolean }[] };
const PLANS: Record<string, Plan> = {
  full: { groups: [
    { g: "none", positions: ["bottom", "center", "top"], names: [true, false], lens: ["l1", "l3", "l6", "max"], choices: true },
    { g: "bustL", positions: ["bottom", "center", "top"], names: [true, false], lens: ["l1", "l3", "l6", "max"], choices: true },
    { g: "bustR", positions: ["bottom", "center", "top"], names: [true, false], lens: ["l1", "l3", "l6", "max"], choices: true },
    { g: "faceL", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
    { g: "faceR", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
    { g: "fullL", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
    { g: "fullR", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
  ] },
  small: { groups: [
    { g: "none", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustL", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustR", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "fullL", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
    { g: "fullR", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6"], choices: false },
  ] },
  en: { groups: [
    { g: "none", positions: ["bottom", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustL", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustR", positions: ["bottom", "center", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
  ] },
  // 룩 프리셋 시트: 프리셋마다 같은 일곱 장면(바 하단·흉상 좌/우·전신·가운데·선택지)을 찍는다.
  look: { groups: [
    { g: "none", positions: ["bottom"], names: [true], lens: ["l3"], choices: true },
    { g: "bustL", positions: ["bottom", "center"], names: [true], lens: ["l3"], choices: false },
    { g: "bustR", positions: ["top"], names: [true], lens: ["l3"], choices: false },
    { g: "fullL", positions: ["bottom"], names: [true], lens: ["l1"], choices: false },
  ] },
  // 흉상 아래 고정 전 조합: 흉상 좌/우·전신 좌/우 × 위/가운데/아래 설정 × 이름 있음/없음 × 1·3·6줄(+ 흉상 없는 대조군).
  bb: { groups: [
    { g: "none", positions: ["top", "center", "bottom"], names: [true], lens: ["l3"], choices: false },
    { g: "bustL", positions: ["top", "center", "bottom"], names: [true, false], lens: ["l1", "l3", "l6"], choices: false },
    { g: "bustR", positions: ["top", "center", "bottom"], names: [true, false], lens: ["l1", "l3", "l6"], choices: false },
    { g: "fullL", positions: ["top", "center", "bottom"], names: [true, false], lens: ["l1", "l3", "l6"], choices: false },
    { g: "fullR", positions: ["top", "center", "bottom"], names: [true, false], lens: ["l1", "l3", "l6"], choices: false },
  ] },
  // 흉상 → 아래 고정 증명: 위·가운데 설정 위에서 흉상 있는 줄/없는 줄을 섞는다(전환 때 튀는지·선택지·48px 얼굴 제외 포함).
  bustbottom: { groups: [
    { g: "none", positions: ["top"], names: [true], lens: ["l1"], choices: false },
    { g: "bustL", positions: ["top"], names: [true], lens: ["l3"], choices: true },
    { g: "none", positions: ["center"], names: [true], lens: ["l1"], choices: false },
    { g: "fullR", positions: ["center"], names: [true], lens: ["l1"], choices: false },
    { g: "none", positions: ["top"], names: [true], lens: ["l1"], choices: false },
    { g: "bustR", positions: ["top"], names: [true], lens: ["l1"], choices: true },
    { g: "faceL", positions: ["top"], names: [true], lens: ["l1"], choices: false },
    { g: "bustL", positions: ["bottom"], names: [true], lens: ["l1"], choices: false },
    { g: "none", positions: ["bottom"], names: [true], lens: ["l1"], choices: false },
  ] },
  cjk: { groups: [
    { g: "none", positions: ["bottom"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustL", positions: ["bottom", "top"], names: [true], lens: ["l1", "l6", "max"], choices: true },
    { g: "bustR", positions: ["bottom", "top"], names: [true], lens: ["l1", "l6"], choices: true },
  ] },
};
const plan = PLANS[profile === "ja" || profile === "zh" ? "cjk" : profile] ?? PLANS.full!;

const commands: any[] = [];
const beats: { n: number; tag: string; group: string; groupLabel: string; position: string; named: boolean; len: string; lenLabel: string; kind: "text" | "choices" }[] = [];
let n = 0;
let lastFace = "";
let lastPos = "";
for (const g of plan.groups) {
  const group = GROUPS[g.g]!;
  const faceKey = group.face ? `${group.face.resourceId}|${group.face.position}` : "none";
  if (faceKey !== lastFace) {
    if (group.face) commands.push({ kind: "changeFace", resourceId: group.face.resourceId, ...(group.face.presentation ? { presentation: group.face.presentation } : {}), position: group.face.position, flipHorizontally: false });
    else commands.push({ kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false });
    lastFace = faceKey;
  }
  for (const position of g.positions) {
    commands.push({ kind: "displayTextSettings", format: "normal", position, preventObscuringPlayer: false, allowEventMovementDuringWait: false });
    lastPos = position;
    for (const named of g.names) for (const len of g.lens) {
      n += 1;
      const tag = `[${String(n).padStart(3, "0")}]`;
      commands.push({ kind: "text", ...(named ? { speaker: NAME } : {}), body: `${tag} ${BODY[language]![len]}` });
      beats.push({ n, tag, group: group.id, groupLabel: group.label, position, named, len, lenLabel: LENGTH_LABEL[len]!, kind: "text" });
      if (g.choices && named && len === (g.lens.includes("l3") ? "l3" : "l1")) {
        n += 1;
        const ctag = `[${String(n).padStart(3, "0")}]`;
        commands.push({ kind: "text", speaker: NAME, body: `${ctag} ${BODY[language]!.l1}` });
        commands.push({ kind: "choices", prompt: CHOICE_PROMPT[language], options: CHOICES[language]!.map((text) => ({ text, branch: [] })) });
        beats.push({ n, tag: ctag, group: group.id, groupLabel: group.label, position, named: true, len: "choice", lenLabel: "선택지", kind: "choices" });
      }
    }
  }
}
commands.push({ kind: "text", speaker: NAME, body: "[END] 끝." });

let r: any = runTool(ctx, "place_npc", { mapId: map.id, x: npcCell.x, y: npcCell.y, name: "서수현", movement: "fixed", characterId: "char_suhyun", talkFriendship: false, pages: [{ lines: ["x"] }] });
if (!r.ok) throw new Error(JSON.stringify(r));
const live = (ctx as any).project as Project;
live.meta.oprnDialogueSystem = mergeDialogueSystem(resolveDialogueSystem(live), { language: language as never, defaults: { textSpeed: "fast" } });
if (vnLookJson) (live.meta as any).oprnVnLook = JSON.parse(vnLookJson);
const npc = live.maps[map.id]!.events.find((e) => e.name === "서수현")!;
(npc as any).pages[0].commands = commands;
const adj = dirs.map(([d, dx, dy]) => ({ d, x: npc.x - dx, y: npc.y - dy })).find((a) => prev.has(key(a.x, a.y)) && !(a.x === npc.x && a.y === npc.y))!;
const moves: { kind: "move"; dir: string }[] = [];
for (let c = key(adj.x, adj.y); prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
const face = (["up", "down", "left", "right"] as const).find((_d, i) => adj.x + dirs[i]![1] === npc.x && adj.y + dirs[i]![2] === npc.y)!;
writeFileSync(`${outDir}/project.json`, serialize(live));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ mapId: map.id, start: project.startPos, npc: { x: npc.x, y: npc.y }, at: { x: adj.x, y: adj.y }, face, moves, applied, language, profile, beats }, null, 1));
console.log(JSON.stringify({ profile, language, beats: beats.length, commands: commands.length, size: [map.width, map.height] }));
