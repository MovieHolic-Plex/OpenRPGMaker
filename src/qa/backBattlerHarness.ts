// 전투 화면 시각 QA 하네스 (qa-back-battler.html 이 로드한다).
//
// 제품 코드를 그대로 쓴다: 프로젝트를 store 에 넣고, 실제 `createBattleRuntime` 으로 전투를
// 만들고, 실제 `mountBattleScene` 으로 화면을 세운다. 맵·phaser 는 태우지 않는다 — 전투 화면은
// DOM + CSS 이므로 그 경로 없이도 진짜 레이아웃을 볼 수 있다.
//
// 처음엔 액터별 뒷모습 배틀러(back-battler) 검수용으로 만들었고, 지금은 전투 이펙트 프레임
// 캡처(`scripts/qa/probe-battle-anim-frames.mjs`)도 같은 진입점을 쓴다.
//
// 스크립트가 쓰는 조작 지점은 `window.__qaBattle` 하나다.
import "@/styles/runtime/playerRuntime.css";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { spawnDeathShards } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
// 출하 플레이어 빌드는 `@/project/store` 를 `exportProjectStoreShim.ts` 로 별칭 처리한다
// (vite.player.config.ts:13). 그 shim 은 `getCurrent()` 만 있고 `replace()` 가 없으므로
// 프로젝트 주입은 `setExportedProject()` 로 해야 한다. 이 하네스는 player 설정으로 서빙되니
// 여기서도 같은 shim 이 잡힌다 — 즉 이게 출하 경로와 같은 store 다.
import { setExportedProject, store } from "@/player/exportProjectStoreShim";
import type { Project } from "@/project/types";

interface QaMountRequest {
  /** 프로젝트 JSON 문자열(직렬화 형식). 스크립트가 넣어 준다. */
  readonly projectJson: string;
  readonly troopId: string;
  /**
   * 저장된 픽스처는 번들 이펙트 팩(anim_gen_*) 이전 스냅샷일 수 있다. 편집기의 `store.replace`
   * 는 로드 때 `ensureBundledBattleAnimations` 로 되채우지만 이 하네스는 shim 경로라 그 수렴을
   * 타지 않는다. 켜면 같은 함수를 여기서 돌려 기본 DB 의 애니메이션 레코드를 전부 싣는다.
   */
  readonly ensureBundledAnimations?: boolean;
  /**
   * 평타(공격 명령)가 재생할 애니메이션 id 를 강제한다. `normalAttackAnimationId()` 의 해석
   * 순서(액터 unarmed → 클래스 → skill_attack)를 전부 이 id 로 덮어 어느 경로로 풀려도 같은
   * 이펙트가 나오게 한다 — 이펙트 프레임 캡처가 "공격 한 번" 으로 원하는 시트를 보게 하기 위해서다.
   */
  readonly attackAnimationId?: string;
}

declare global {
  interface Window {
    __qaBattle: {
      mount: (request: QaMountRequest) => { ok: true } | { ok: false; error: string };
      /** 격파 조각을 index 번째 적에 강제로 뿌린다 — 조각 CSS 를 격파 없이 검사하기 위한 디버그 훅. */
      spawnShards: (enemyIndex: number) => boolean;
      ready: boolean;
    };
  }
}

const host = document.querySelector<HTMLElement>("#battle-host");
if (!host) throw new Error("QA 하네스: #battle-host 가 없다");

function forceAttackAnimation(project: Project, animationId: string): void {
  if (!project.database.battleAnimations.some((record) => record.id === animationId)) {
    throw new Error(`attackAnimationId ${animationId} 가 프로젝트에 없다 (ensureBundledAnimations 를 켰는가?)`);
  }
  for (const actor of project.database.actors) actor.unarmedAnimationId = animationId;
  for (const klass of project.database.classes) klass.animationId = animationId;
  const attack = project.database.skills.find((skill) => skill.id === "skill_attack");
  if (attack) attack.animationId = animationId;
}

window.__qaBattle = {
  ready: true,
  spawnShards: (enemyIndex) => {
    const node = host.querySelectorAll<HTMLElement>(".battle-enemy")[enemyIndex];
    if (!node) return false;
    spawnDeathShards(node);
    return true;
  },
  mount: ({ projectJson, troopId, ensureBundledAnimations, attackAnimationId }) => {
    try {
      destroyBattleSceneOnHost(host);
      const project = deserialize(projectJson);
      if (ensureBundledAnimations) ensureBundledBattleAnimations(project);
      if (attackAnimationId) forceAttackAnimation(project, attackAnimationId);
      // battleFieldDom 은 store.getCurrent() 로 리소스를 해석하고 스킨을 읽는다.
      setExportedProject(project);
      if (store.getCurrent() !== project) throw new Error("store 주입 실패");
      const runtime = createBattleRuntime({
        project,
        troopId,
        canEscape: true,
        canLose: true,
        // 결정적 RNG — 같은 화면이 매번 나와야 스크린샷 비교가 성립한다.
        rng: () => 0.5,
      });
      mountBattleScene({
        host,
        runtime,
        onResult: () => {
          /* QA 는 첫 화면만 본다 */
        },
        // 인트로 연출을 붙잡지 않는다 — 전환 애니메이션이 끝난 정적 화면이 필요하다.
        introHold: false,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String((error as Error)?.message ?? error) };
    }
  },
};
