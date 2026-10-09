// @vitest-environment happy-dom
// 증분 본문 렌더러. 이 파일의 핵심 단정은 **노드 동일성**이다.
//
// 예전 본문 경로는 글자가 하나 늘 때마다 전량 재생성이라 이미 떠 있던 글자의 노드까지
// 매 틱 바뀌었고, 그래서 글자별 CSS 애니메이션이 프레임마다 되감겼다. 그 회귀는
// 화면으로도, computed style 로도 잡히지 않는다 — 애니메이션은 "매번 처음부터 다시"
// 도는 동안에도 계속 재생 중으로 보인다. 노드가 유지되는지를 직접 재는 것만이 판정이다.
import { beforeEach, describe, expect, it } from "vitest";
import { mountDialoguePage, renderDialogueSegments } from "@/player/dialogueTextRenderer";
import type { DialogueTextSegment } from "@/player/dialoguePagination";

function segment(text: string, colorIndex = 0): DialogueTextSegment {
  return { text, colorIndex };
}

function target(): HTMLElement {
  const node = document.createElement("div");
  document.body.append(node);
  return node;
}

function chars(node: HTMLElement): HTMLElement[] {
  return [...node.querySelectorAll<HTMLElement>(".dialogue-char")];
}

describe("증분 본문 렌더러", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reveal 은 앞 글자의 노드를 재생성하지 않는다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("가나다라")]);

    renderer.reveal(2);
    const first = chars(host);
    expect(first).toHaveLength(2);

    renderer.reveal(4);
    const grown = chars(host);
    expect(grown).toHaveLength(4);
    // 같은 배열이 아니라 같은 **노드**여야 한다.
    expect(grown[0]).toBe(first[0]);
    expect(grown[1]).toBe(first[1]);
  });

  it("textContent 는 드러난 글자까지만 담는다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("abcde")]);

    expect(host.textContent).toBe("");
    renderer.reveal(1);
    expect(host.textContent).toBe("a");
    renderer.reveal(3);
    expect(host.textContent).toBe("abc");
    renderer.revealAll();
    expect(host.textContent).toBe("abcde");
  });

  it("마운트는 대상을 비우고 글자 수를 알려준다", () => {
    const host = target();
    host.append(document.createTextNode("이전 페이지"));
    const renderer = mountDialoguePage(host, [segment("하나"), segment("둘", 3)]);
    expect(host.textContent).toBe("");
    expect(renderer.length).toBe(3);
  });

  it("색 세그먼트는 글자마다 색 클래스를 유지한다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("무"), segment("색칠", 4)]);
    renderer.revealAll();

    const list = chars(host);
    expect(list.map((node) => node.className)).toEqual([
      "dialogue-char dialogue-char-instant",
      "dialogue-char dialogue-color dialogue-color-4 dialogue-char-instant",
      "dialogue-char dialogue-color dialogue-color-4 dialogue-char-instant",
    ]);
  });

  it("줄바꿈은 글자 한 칸으로 보존된다", () => {
    // 페이지네이터가 줄바꿈을 명시 "\n" 으로 확정하고 .body 는 white-space: pre-wrap 이다.
    // 줄바꿈도 char 토큰 한 칸을 쓰므로(dialoguePlaybackTokens) 여기서도 한 노드여야
    // 타이핑 인덱스가 어긋나지 않는다.
    const host = target();
    const renderer = mountDialoguePage(host, [segment("가\n나")]);
    expect(renderer.length).toBe(3);
    renderer.reveal(2);
    expect(host.textContent).toBe("가\n");
  });

  it("서로게이트 쌍은 쪼개지지 않는다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("a🙂b")]);
    expect(renderer.length).toBe(3);
    renderer.reveal(2);
    expect(host.textContent).toBe("a🙂");
  });

  it("한꺼번에 드러난 글자는 연출을 건너뛴다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("가나다")]);
    renderer.reveal(1);
    renderer.revealAll();

    const list = chars(host);
    // 타이핑으로 이미 떠 있던 첫 글자는 자기 연출을 그대로 유지한다.
    expect(list[0]?.classList.contains("dialogue-char-instant")).toBe(false);
    expect(list[1]?.classList.contains("dialogue-char-instant")).toBe(true);
    expect(list[2]?.classList.contains("dialogue-char-instant")).toBe(true);
  });

  it("reveal 은 범위를 벗어난 값에 무너지지 않는다", () => {
    const host = target();
    const renderer = mountDialoguePage(host, [segment("가나")]);
    renderer.reveal(-5);
    expect(chars(host)).toHaveLength(0);
    renderer.reveal(99);
    expect(chars(host)).toHaveLength(2);
    renderer.reveal(Infinity);
    expect(chars(host)).toHaveLength(2);
  });

  it("되감으면 남는 글자의 노드는 그대로다", () => {
    // 실제 재생 경로는 뒤로 가지 않지만(페이지가 바뀌면 새로 마운트한다) 되감기에서
    // 앞 글자를 재생성해 버리면 연출 되감김 문제가 되돌아온다.
    const host = target();
    const renderer = mountDialoguePage(host, [segment("가나다")]);
    renderer.reveal(3);
    const before = chars(host);
    renderer.reveal(1);
    expect(chars(host)).toEqual([before[0]]);
  });

  it("일괄 렌더는 색이 같은 글자를 한 노드로 묶는다", () => {
    // 선택지·프롬프트는 타이핑이 없으므로 글자별 노드가 필요 없다.
    const host = target();
    renderDialogueSegments(host, [segment("보통 "), segment("강조", 2)]);
    expect(host.childNodes).toHaveLength(2);
    expect(host.textContent).toBe("보통 강조");
    expect((host.childNodes[1] as HTMLElement).className).toBe("dialogue-color dialogue-color-2");
  });

  it("일괄 렌더도 visibleChars 로 잘린다", () => {
    const host = target();
    renderDialogueSegments(host, [segment("abc"), segment("de", 1)], 4);
    expect(host.textContent).toBe("abcd");
  });
});
