import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";

/**
 * 카메라 필터 셰이더 공용 등록기 (Phaser 4).
 *
 * - 프래그먼트 소스는 **`#pragma phaserTemplate(shaderName)` 한 줄만** 쓴다. Phaser 가 그 줄을
 *   `#define SHADER_NAME …` 로 바꿔 주므로 소스에 `#define SHADER_NAME` 을 또 쓰면
 *   "SHADER_NAME : macro redefined" 로 컴파일이 깨진다(J01, 시간문·균열 검정 고착의 원인).
 * - 컴파일은 첫 그리기에서 일어나고, 실패하면 렌더 루프 전체가 예외로 멈춘다. 그래서 등록하면서
 *   **미리 한 번 컴파일해 보고**, 실패하면 노드를 등록하지 않고 `false` 를 돌려준다 — 호출자는
 *   그 효과만 건너뛰고 전환·이동은 계속한다.
 */

type FilterShaderNode = Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader & {
  setupUniforms(controller: Phaser.Filters.Controller, drawingContext: Phaser.Renderer.WebGL.DrawingContext): void;
  programManager: { getCurrentProgramSuite(): unknown };
};

const failedNames = new Set<string>();

export type FilterShaderRegistration = {
  readonly name: string;
  readonly fragmentSource: string;
  readonly setupUniforms: (
    node: FilterShaderNode,
    controller: Phaser.Filters.Controller,
    drawingContext: Phaser.Renderer.WebGL.DrawingContext,
  ) => void;
};

/** 노드가 이미 있으면 true, 새로 등록·컴파일 확인에 성공하면 true, 컴파일이 깨지면 false(한 번만 경고). */
export function ensureFilterShaderNode(
  nodes: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager,
  registration: FilterShaderRegistration,
): boolean {
  const { name } = registration;
  if (failedNames.has(name)) return false;
  if (nodes.getNode(name)) return true;
  try {
    const PhaserRuntime = getLoadedPhaser();
    const node = new PhaserRuntime.Renderer.WebGL.RenderNodes.BaseFilterShader(
      name,
      nodes,
      undefined,
      registration.fragmentSource,
    ) as FilterShaderNode;
    node.setupUniforms = function (controller, drawingContext) {
      registration.setupUniforms(this, controller, drawingContext);
    };
    // 미리 컴파일 — 실패하면 여기서 예외가 나므로 렌더 루프에 닿기 전에 막힌다.
    node.programManager.getCurrentProgramSuite();
    nodes.addNode(name, node);
    return true;
  } catch (error) {
    failedNames.add(name);
    console.warn(`[player] 화면 효과 셰이더 "${name}" 컴파일 실패 — 이 효과만 건너뜁니다.`, error);
    return false;
  }
}

/** 테스트·진단용 — 컴파일에 실패해 꺼진 셰이더 이름. */
export function failedFilterShaders(): readonly string[] {
  return [...failedNames];
}
