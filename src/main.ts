// 앱 진입점: store 로드 + 에디터 부팅.

import "./styles.css";
import { bootApp } from "@/app/mode";

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

void bootApp(app);
