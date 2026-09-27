// i18n/domTranslator.ts
// 편집기 DOM 의 한국어 글자를 선택한 언어로 바꿔 보여 준다.
//
// 왜 DOM 계층인가: 한국어 UI 문자열이 1,100여 파일에 약 1만 4천 개 인라인으로 박혀 있다.
// 호출부마다 t() 로 감싸는 전환은 한 PR 로 끝낼 수 없고, 그동안 새 코드가 계속 한국어를 넣는다.
// 그래서 **원문은 그대로 두고** 렌더된 텍스트 노드와 속성(title·aria-label·placeholder·alt)을
// 카탈로그로 바꾼다. 카탈로그에 없는 글자(사용자 저작 콘텐츠·AI 답변)는 절대 건드리지 않는다.
//
// 원문 보존: 바꾼 노드마다 원문과 표시값을 기억한다. 언어를 다시 고르면 원문에서 다시 번역하고,
// 앱이 노드 글자를 새로 쓰면(표시값과 달라지면) 그 새 글자를 원문으로 삼는다.
//
// 번역하지 않는 곳: 게임 화면(.player-layout — 저자가 출하하는 게임의 글자라 편집기 언어를 따르면 안 된다),
// 입력 영역(textarea·contenteditable), 코드 블록, `translate="no"` / `.notranslate` / `[data-i18n-skip]`.

import { containsHangul, type Translator } from "@/i18n/translator";

const TRANSLATED_ATTRIBUTES = ["title", "aria-label", "placeholder", "alt"] as const;
// 속성까지 통째로 건너뛰는 영역.
const SKIP_SELECTOR = ["script", "style", "[translate='no']", ".notranslate", "[data-i18n-skip]", ".player-layout"].join(",");
// 안의 글자(사용자 입력)만 건너뛰고, placeholder·title 같은 자기 속성은 번역하는 요소.
const TEXT_ONLY_SKIP_SELECTOR = ["textarea", "code", "pre", "[contenteditable='true']", "[contenteditable='']"].join(",");

type Shown = { source: string; shown: string };

const textState = new WeakMap<Text, Shown>();
const attrState = new WeakMap<Element, Map<string, Shown>>();

// 앱 코드가 화면 글자를 다시 읽어 한국어 원문과 비교하는 곳(상태 문구·확대 단추 등)은
// textContent 대신 이 두 함수를 쓴다. 번역 계층이 없거나 아직 안 바꾼 노드면 화면 값 그대로다.
export function sourceTextOf(node: Node | null | undefined): string {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    const state = textState.get(text);
    return state && state.shown === text.data ? state.source : text.data;
  }
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.ELEMENT_NODE) out += sourceTextOf(child);
  });
  return out;
}

export function sourceAttributeOf(element: Element, name: string): string | null {
  const current = element.getAttribute(name);
  if (current === null) return null;
  const state = attrState.get(element)?.get(name);
  return state && state.shown === current ? state.source : current;
}

export type DomTranslator = {
  retranslate(translator: Translator | null): void;
  stop(): void;
};

export function installDomTranslator(root: Node, initial: Translator | null): DomTranslator {
  let translator = initial;
  const cache = new Map<string, string | null>();

  const lookup = (source: string): string | null => {
    if (!translator) return null;
    const hit = cache.get(source);
    if (hit !== undefined) return hit;
    const core = source.trim();
    const translated = translator.translate(core);
    const result = translated === null ? null : source.slice(0, source.indexOf(core)) + translated + source.slice(source.indexOf(core) + core.length);
    cache.set(source, result);
    return result;
  };

  const skipped = (element: Element | null): boolean => element !== null && element.closest(SKIP_SELECTOR) !== null;
  const textSkipped = (element: Element | null): boolean =>
    element !== null && (element.closest(SKIP_SELECTOR) !== null || element.closest(TEXT_ONLY_SKIP_SELECTOR) !== null);

  const translateText = (node: Text): void => {
    const current = node.data;
    const state = textState.get(node);
    const source = state && state.shown === current ? state.source : current;
    if (!containsHangul(source)) {
      if (state) textState.delete(node);
      return;
    }
    if (textSkipped(node.parentElement)) return;
    const next = lookup(source) ?? source;
    if (next !== current) node.data = next;
    textState.set(node, { source, shown: next });
  };

  const translateAttributes = (element: Element): void => {
    for (const name of TRANSLATED_ATTRIBUTES) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      const states = attrState.get(element);
      const state = states?.get(name);
      const source = state && state.shown === current ? state.source : current;
      if (!containsHangul(source)) continue;
      if (skipped(element)) return;
      const next = lookup(source) ?? source;
      if (next !== current) element.setAttribute(name, next);
      const map = states ?? new Map<string, Shown>();
      map.set(name, { source, shown: next });
      if (!states) attrState.set(element, map);
    }
  };

  const translateTree = (start: Node): void => {
    if (start.nodeType === Node.TEXT_NODE) {
      translateText(start as Text);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE && start.nodeType !== Node.DOCUMENT_NODE && start.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (start.nodeType === Node.ELEMENT_NODE) {
      if (skipped(start as Element)) return;
      translateAttributes(start as Element);
    }
    if (start.nodeType === Node.ELEMENT_NODE && (start as Element).closest(TEXT_ONLY_SKIP_SELECTOR)) return;
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
        const element = node as Element;
        if (element.matches(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (element.matches(TEXT_ONLY_SKIP_SELECTOR)) {
          translateAttributes(element);
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
      else translateAttributes(node as Element);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((node) => translateTree(node));
      } else if (record.type === "characterData") {
        translateText(record.target as Text);
      } else if (record.type === "attributes") {
        translateAttributes(record.target as Element);
      }
    }
  });

  translateTree(root);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATED_ATTRIBUTES],
  });

  return {
    retranslate(next: Translator | null): void {
      translator = next;
      cache.clear();
      translateTree(root);
      observer.takeRecords();
    },
    stop(): void {
      observer.disconnect();
    },
  };
}
