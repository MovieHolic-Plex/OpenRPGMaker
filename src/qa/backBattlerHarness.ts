// 액터별 뒷모습 배틀러 시각 QA 하네스 (qa-back-battler.html 이 로드한다).
//
// 제품 코드를 그대로 쓴다: 프로젝트를 store 에 넣고, 실제 `createBattleRuntime` 으로 전투를
// 만들고, 실제 `mountBattleScene` 으로 화면을 세운다. 맵·phaser 는 태우지 않는다 — 전투 화면은
// DOM + CSS 이므로 그 경로 없이도 진짜 레이아웃을 볼 수 있다.
//
// 스크립트가 쓰는 조작 지점은 `window.__qaBattle` 하나다.
import "@/styles/runtime/playerRuntime.css";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { deserialize } from "@/project/io";
// 출하 플레이어 빌드는 `@/project/store` 를 `exportProjectStoreShim.ts` 로 별칭 처리한다
// (vite.player.config.ts:13). 그 shim 은 `getCurrent()` 만 있고 `replace()` 가 없으므로
// 프로젝트 주입은 `setExportedProject()` 로 해야 한다. 이 하네스는 player 설정으로 서빙되니
// 여기서도 같은 shim 이 잡힌다 — 즉 이게 출하 경로와 같은 store 다.
import { setExportedProject, store } from "@/player/exportProjectStoreShim";

interface QaMountRequest {
  /** 프로젝트 JSON 문자열(직렬화 형식). 스크립트가 넣어 준다. */
  readonly projectJson: string;
  readonly troopId: string;
}

declare global {
  interface Window {
    __qaBattle: {
      mount: (request: QaMountRequest) => { ok: true } | { ok: false; error: string };
      ready: boolean;
    };
  }
}

const host = document.querySelector<HTMLElement>("#battle-host");
if (!host) throw new Error("QA 하네스: #battle-host 가 없다");

window.__qaBattle = {
  ready: true,
  mount: ({ projectJson, troopId }) => {
    try {
      destroyBattleSceneOnHost(host);
      const project = deserialize(projectJson);
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
