// 바라보는 방향 검사 — recordUntilJs 가 남긴 actors.jsonl 을 읽어, 대사 한 줄마다
//   (1) 화자가 듣는 사람(가장 가까운 대화 상대)을 보는가
//   (2) 화자 곁(반경 R칸)의 다른 인물이 화자를 보는가
// 를 따진다. 화자 이름 → 맵 인물은 이름표(event.name)로 잇는다. 서하는 주인공이다.
// 사용: node scripts/qa/runtime/facing-audit.mjs <기록 폴더…> [--json out.json]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const roots = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--json");
const R = Number(process.env.FACING_RADIUS ?? 3);
const R2 = Number(process.env.FACING_RADIUS_WIDE ?? 6);

const SPEAKER_TO_NAME = [
  ["열일곱의 서하", "열일곱"], ["열아홉의 지후", "열아홉"], ["서하", "@player"], ["지후", "강지후"], ["민호", "차민호"],
  ["오 팀장", "오정민"], ["박 본부장", "박 본부장"], ["점원", "점원"], ["회사원", "회사원"],
];

function files(root) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "actors.jsonl") out.push(p); } };
  walk(root);
  return out;
}
const toward = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const out = [];
  if (dx > 0) out.push("right"); if (dx < 0) out.push("left"); if (dy > 0) out.push("down"); if (dy < 0) out.push("up");
  if (Math.abs(dx) > Math.abs(dy)) return [dx > 0 ? "right" : "left"];
  if (Math.abs(dy) > Math.abs(dx)) return [dy > 0 ? "down" : "up"];
  return out; // 대각선 같은 거리: 둘 다 인정
};
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manh = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function actorsOf(rec) {
  const list = [];
  if (rec.player?.visible) list.push({ id: "@player", name: "서하", x: rec.player.x, y: rec.player.y, dir: rec.player.dir });
  for (const [id, e] of Object.entries(rec.events ?? {})) {
    if (!e.dir || e.alpha < 0.3) continue;
    list.push({ id, name: e.name, x: e.x, y: e.y, dir: e.dir });
  }
  return list;
}
function findSpeaker(rec, actors) {
  const sp = rec.speaker?.trim();
  if (!sp) return null;
  const key = SPEAKER_TO_NAME.find(([s]) => sp === s || sp.startsWith(s));
  if (!key) return null;
  if (key[1] === "@player") return actors.find((a) => a.id === "@player") ?? null;
  const cands = actors.filter((a) => a.id !== "@player" && a.name.includes(key[1]));
  return cands[0] ?? null;
}

const problems = [];
let lines = 0;
for (const root of roots) for (const f of files(root)) {
  const recs = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  for (const rec of recs) {
    if (rec.why !== "text" || !rec.text) continue;
    lines += 1;
    const actors = actorsOf(rec);
    const speaker = findSpeaker(rec, actors);
    const where = { file: path.join(path.dirname(f), rec.file), beat: rec.beat, map: rec.map, speaker: rec.speaker, text: rec.text.slice(0, 60) };
    if (!speaker) continue;
    // 지나가는 사람(회사원)은 대화 상대가 아니다 — 화자가 그 사람일 때만 센다.
    const others = actors.filter((a) => a !== speaker && cheb(a, speaker) <= R && (!a.name.includes("회사원") || speaker.name.includes("회사원")));
    if (!others.length) continue;
    // 화자는 곁의 누군가(주인공이 가까우면 보통 주인공)를 본다 — 아무도 보지 않으면 문제.
    // 탁자 건너편처럼 조금 먼 상대도 듣는 사람이다(반경 R2).
    const wide = actors.filter((a) => a !== speaker && cheb(a, speaker) <= R2 && (!a.name.includes("회사원") || speaker.name.includes("회사원")));
    const addressees = wide.filter((o) => toward(speaker, o).includes(speaker.dir));
    const facesSomeone = addressees.length > 0;
    if (!facesSomeone) {
      const player = others.find((a) => a.id === "@player");
      const listener = speaker.id !== "@player" && player ? player : others.slice().sort((a, b) => manh(a, speaker) - manh(b, speaker))[0];
      problems.push({ ...where, kind: "speaker-faces-no-one", who: speaker.name, at: [speaker.x, speaker.y], dir: speaker.dir, want: toward(speaker, listener), listener: listener.name, listenerAt: [listener.x, listener.y] });
    }
    // 곁의 사람은 화자를 보거나, 화자가 말을 거는 주인공을 본다(무리가 함께 주인공을 맞는 장면). 화자에게 등을 돌리면 문제.
    const hero = actors.find((a) => a.id === "@player");
    for (const o of others) {
      if (cheb(o, speaker) > 2 && o !== hero) continue; // 멀리 선 사람은 화자를 안 봐도 된다(탁자 건너편 등)
      const w = toward(o, speaker);
      const alt = hero && o !== hero && speaker !== hero ? toward(o, hero) : [];
      // 화자가 보고 말하는 상대를 함께 보는 것도 괜찮다(회의 탁자에서 같은 쪽에 나란히 앉은 사람).
      const sameAddressee = addressees.some((t) => t !== o && toward(o, t).includes(o.dir));
      if (!w.includes(o.dir) && !alt.includes(o.dir) && !sameAddressee) problems.push({ ...where, kind: o === hero ? "hero-not-facing-speaker" : "listener-not-facing-speaker", who: o.name, at: [o.x, o.y], dir: o.dir, want: w, speakerAt: [speaker.x, speaker.y] });
    }
  }
}
// 같은 장면에서 같은 사람·같은 종류가 이어지면 한 묶음으로.
const groups = [];
for (const p of problems) {
  const last = groups[groups.length - 1];
  if (last && last.kind === p.kind && last.who === p.who && last.beat === p.beat && last.dir === p.dir) { last.count += 1; last.lastText = p.text; continue; }
  groups.push({ ...p, count: 1 });
}
console.log(`대사 ${lines}줄, 문제 ${problems.length}건, 묶음 ${groups.length}`);
for (const g of groups) console.log(`[${g.beat}] ${g.map} ${g.kind} ${g.who}@${g.at} 보는쪽=${g.dir} 원함=${g.want} (화자 ${g.speaker}) ×${g.count} «${g.text}» ${path.basename(g.file)}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ lines, problems, groups }, null, 1));
