/**
 * 하네스 저작 계약만 모은 가벼운 색인.
 *
 * 프로젝트 스키마(`src/project/gameDesignBrief.ts`)는 저장된 `implementation.contract` 를 읽을 때
 * 계약 정규화만 필요하다. 전체 레지스트리(`./registry`)는 모든 하네스의 에디터 실행기·공방 키트까지
 * 끌어오므로, 스키마가 그것을 import 하면 내보낸 플레이어 번들에 공방/object-gen 코드와
 * AI 제공자 주소가 실린다. 계약이 있는 하네스를 추가하면 여기에도 한 줄을 더한다
 * (`test/harnessContracts.test.ts` 가 레지스트리와 대조한다).
 */
import type { HarnessManifest } from "./manifest";
import { ROMANCE_SCENE_HARNESS } from "../romance-scene/harness";

const CONTRACT_HARNESSES: readonly HarnessManifest[] = [ROMANCE_SCENE_HARNESS];

export function getHarnessContract(id: string): HarnessManifest["contract"] | undefined {
  return CONTRACT_HARNESSES.find((harness) => harness.id === id)?.contract;
}

export function contractHarnessIds(): readonly string[] {
  return CONTRACT_HARNESSES.map((harness) => harness.id);
}
