import { readFileSync, writeFileSync } from "node:fs";
const b = JSON.parse(readFileSync("scripts/qa-game/briefs/campus-reunion-romance.json", "utf8"));
const set = (slot, id, text) => { b.brief.interview.choiceIds[slot] = id; b.brief.answers[slot].text = text; };
b.brief.interview.choiceIds.experience = "town";
b.brief.answers.experience.text = "조금씩 가까워지는 이웃 — 도심 카페 알바생과 단골 손님, 퇴근길에 마주쳐요.";
b.brief.summary = b.brief.summary.replace(/이야기의 출발점은[^\n]*/u, "이야기의 출발점은 조금씩 가까워지는 이웃 — 도심 카페 알바생과 단골 손님, 퇴근길에 마주쳐요.");
writeFileSync(process.argv[2], JSON.stringify(b, null, 1));
