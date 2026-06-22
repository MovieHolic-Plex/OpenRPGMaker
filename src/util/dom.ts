// util/dom.ts
// 바닐라 DOM 생성 헬퍼. 간결한 el() 빌더.

export type ElProps = {
  class?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string>;
  // 이벤트 리스너.
  on?: Record<string, EventListener>;
  // 자식(문자열 또는 노드). 순서대로 append.
  children?: (Node | string)[];
  // 입력값(value).
  value?: string | number;
  // 선택 속성.
  dataset?: Record<string, string>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.value !== undefined) {
    (node as HTMLInputElement).value = String(props.value);
  }
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) {
      node.setAttribute(k, v);
    }
  }
  if (props.dataset) {
    for (const [k, v] of Object.entries(props.dataset)) {
      node.dataset[k] = v;
    }
  }
  if (props.on) {
    for (const [evt, handler] of Object.entries(props.on)) {
      node.addEventListener(evt, handler);
    }
  }
  if (props.children) {
    for (const child of props.children) {
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
  }
  return node;
}

// 노드의 자식을 전부 비우기.
export function clearChildren(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
