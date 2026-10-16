// editor/aiJobNumbers.ts
// 「작업 목록」의 번호 — 지도 위 상자·핀과 목록 행이 같은 번호·같은 색을 쓰게 하는 작은 등록소.
//
// 왜: AI 일은 다섯 줄기(대화·팀 레인·드래그 영역·바로 깔기·이벤트 작업함)가 제각기 번호를 붙였다
// (바로 깔기는 주문 id, 이벤트 핀은 작업 id, 나머지는 번호가 아예 없었다). 목록 한 줄과 지도 위 상자를 잇는 것은
// 같은 번호 하나뿐이라, 번호를 종류와 무관한 하나의 순서로 모은다.
//
// 규칙:
//  - 열쇠(`p:<presence id>` · `stamp:<주문 id>` · `event:<작업 id>`)를 처음 보면 다음 번호를 준다. 같은 열쇠는 늘 같은 번호.
//  - 색은 번호에서 나온다(`jobTone`) — 한 일의 색이 도중에 바뀌지 않는다(예전엔 목록 위치로 정해 한 일이 끝나면 다른 일의 색이 밀렸다).
//  - 살아 있는 열쇠가 하나도 없어지면 번호를 1 부터 다시 센다. 그 전에는 쓰던 번호를 다시 주지 않는다.
//  - 모듈 싱글턴이고 DOM·스토어를 모른다 — 지도 쪽 그리기(Phaser·DOM)가 import 해도 순환이 없다.

const numbers = new Map<string, number>();
let next = 1;

/** 열쇠의 번호. 처음이면 새로 준다. */
export function jobNumber(key: string): number {
  const known = numbers.get(key);
  if (known !== undefined) return known;
  const assigned = next++;
  numbers.set(key, assigned);
  return assigned;
}

/**
 * 열쇠가 바뀌어도 같은 일이면 번호를 잇는다 — 다른 맵 일은 차례를 기다릴 때 `bg<표>` 였다가 보드가 오면 `bg<표>:<에이전트>` 가 된다.
 * `from` 이 번호를 갖고 있고 `to` 는 아직 없을 때만 `from` 의 번호를 `to` 로 옮긴다(번호가 건너뛰어 지도·목록이 어긋나 보이지 않게).
 */
export function adoptJobNumber(to: string, from: string): void {
  if (numbers.has(to)) return;
  const known = numbers.get(from);
  if (known === undefined) return;
  numbers.delete(from);
  numbers.set(to, known);
}

/** 번호를 새로 주지 않고 본다. */
export function peekJobNumber(key: string): number | undefined {
  return numbers.get(key);
}

/** 색 번호(0~3) → CSS 색. 34-ai-presence.css 의 --tone-0..3 과 같은 값 — 지도 위 Phaser·핀은 CSS 변수를 못 읽는 곳이 있어 여기서 쓴다. */
export const JOB_TONE_CSS: readonly string[] = ["#3b5bdb", "#12a150", "#c2410c", "#7c3aed"];

/** 색 번호(0~3) — 번호에서 바로 나온다. */
export function jobTone(no: number): number {
  return (Math.max(1, no) - 1) % 4;
}

/** 살아 있는 열쇠만 남긴다. 하나도 없으면 번호를 다시 1 부터 센다. */
export function retainJobNumbers(live: ReadonlySet<string>): void {
  for (const key of numbers.keys()) if (!live.has(key)) numbers.delete(key);
  if (numbers.size === 0) next = 1;
}

/** 테스트 전용. */
export function resetJobNumbersForTest(): void {
  numbers.clear();
  next = 1;
}
