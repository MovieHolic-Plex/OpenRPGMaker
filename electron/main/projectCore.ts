// 메인 프로세스의 «프로젝트 코어» 별도 번들 입구(dist-electron/project-core.cjs).
//
// 역직렬화(loadRepair)·저장 직렬화(io/serialize)는 번들 타일셋·참고문서 약 80MB 를 끌고 온다(소유 참고문서 복원 때문).
// 메인 번들(main.cjs)에 같이 넣으면 앱을 켤 때마다 그 80MB 를 읽고 훑느라 창이 뜨기 전 2.6초가 들었다(2026-10-20 실측).
// scripts/build-electron.mjs 가 메인 번들에서 이 두 모듈을 «처음 쓸 때 이 파일을 require 하는» 얇은 대역으로 바꾼다.
// 소스(테스트·oprn-serve·스크립트)는 그대로 원래 모듈을 직접 import 한다 — 바뀌는 것은 데스크톱 메인 번들뿐이다.
export * as loadRepair from "../../src/project/persistence/core/loadRepair";
export * as serialize from "../../src/project/io/serialize";
