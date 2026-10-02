// Task 6 에서 통째로 바꾼다. (Task 5 동안 매니페스트의 지연 import 가 타입 해석되게 하는 자리 표시)
export function createInteriorRunner(): import("@/harnesses/_core/workshop/types").WorkshopRunner {
  throw new Error("interior-props 실행기는 Task 6 에서 만든다");
}
