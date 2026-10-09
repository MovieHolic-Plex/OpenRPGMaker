// storageBoot.ts
// **부수효과 전용 모듈.** 구 저장 키 접두사(rpg-zzu → oprn) 마이그레이션을 앱에서
// 가장 먼저 실행한다.
//
// 왜 별도 모듈인가 —
// ES 모듈의 `import` 는 호이스팅되므로 진입점 본문에서 `migrateLegacyStorageKeys()` 를
// 호출해도 **다른 import 들이 이미 평가된 뒤**다. import 시점에 localStorage 를 읽는 모듈이
// 있으면(옛 편집 모드 모듈이 그랬다) 그 전에 키를 옮겨놓지 않으면 첫 부팅에서 저장값이
// 기본값으로 보인다.
// 부수효과 import 는 소스에 적힌 순서대로 평가되므로, 진입점 맨 위에서 이 모듈을
// import 하면 순서가 보장된다.
//
// 진입점: src/main.ts (에디터), src/player/exportEntry.ts (플레이어).

import { migrateLegacyStorageKeys } from "@/util/appStorage";

migrateLegacyStorageKeys();
