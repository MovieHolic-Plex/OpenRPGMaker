// 부수효과 import 만 있는 모듈이어야 한다: scripts/lib/css-entries.mjs 가 TS 의 `import "….css"` 로
// CSS 엔트리를 찾으므로, 동적 import("….css") 로 바꾸면 런타임 시트 전체가 그래프 게이트에서 고아가 된다.
import "@/styles/runtime/index.css";
