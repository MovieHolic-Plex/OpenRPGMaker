interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  // VITE_YUNWU_API_KEY / VITE_LLM_API_KEY / VITE_LLM_API_URL 은 선언을 걷었다.
  // 앞의 둘은 키를 클라이언트 번들에 인라인하던 통로이고, 마지막 것은 에디터의 인증
  // 모드를 정해 AI 를 반복적으로 죽인 통로다(llmClient.defaultAiConfig 주석 참고).
  // 되살리지 말 것 — 게이트웨이가 필요한 소비자는 설정을 직접 주입한다.
  // 레거시 — 클라이언트 번들에 anon 키를 인라인한다. VITE_SUPABASE_USE_PROXY=1 을 쓰면
  // 서버 전용 SUPABASE_ANON_KEY 를 /supabase 프록시가 주입하므로 이 값이 필요 없다.
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** "1"/"true" 면 브라우저가 항상 같은-오리진 /supabase 로 나가고 자격증명은 서버가 붙인다. */
  readonly VITE_SUPABASE_USE_PROXY?: string;
  /** AI 활동 로그 디스크 미러. 미지정=첫 요청으로 판별, "0"=빌드에서 완전히 제거. */
  readonly VITE_AI_ACTIVITY_DISK_MIRROR?: string;
  readonly VITE_TOUCH_CONTROLS?: string;
  // 플레이어 익스포트 빌드(vite.player.config.ts, envPrefix "OPENRPG_PLAYER_")용 오버라이드.
  readonly OPENRPG_PLAYER_TOUCH_CONTROLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


type OprnPlayerSpriteDebug = {
  readonly textureKey: string;
  readonly frame: string | number;
  readonly resourceId: string;
  readonly kind: string;
  readonly moving: boolean;
  readonly x: number;
  readonly y: number;
};

type OprnRuntimeJuiceEvent =
  | "menu-back"
  | "menu-close"
  | "menu-confirm"
  | "menu-invalid"
  | "menu-open"
  | "menu-select"
  | "title-confirm"
  | "title-enter"
  | "title-select";

type OprnRuntimeJuiceLogEntry = {
  readonly event: OprnRuntimeJuiceEvent;
  readonly soundResourceId: string;
  readonly motionClass: string;
  readonly durationMs: number;
};

type OprnCameraDebug = {
  readonly height: number;
  readonly width: number;
  readonly zoom: number;
};

interface Window {
  __RPG_ZZU_E2E_PROJECT__?: unknown;
  __oprnProjectE2E?: import("@/editor/editorToolHook").ProjectE2EBridge;
  // 영역 작업 마지막 로그 export (감사·툴·하네스) — 콘솔/헤드리스 디버깅용.
  __oprnRegionTaskLog?: unknown;
  __oprnLastRegionTaskLog?: () => unknown;
  // 영역 작업 승인 게이트 pending (get/apply/discard) — E2E·디버깅용.
  __oprnRegionTaskPending?: {
    get: () => unknown;
    apply: () => void;
    discard: () => void;
  };
  // AI 활동 로그 링버퍼 (채팅·영역 등) — localStorage + optional Supabase.
  __oprnAiActivityLog?: unknown;
  __oprnListAiActivityLogs?: (limit?: number) => readonly unknown[];
  __oprnGetAiActivityLog?: (id: string) => unknown;
  __oprnClearAiActivityLogs?: () => void;
  __oprnExportAiActivityLogs?: (limit?: number) => string;
  // 이 탭의 런 식별자. DB 에서 "내 런의 최신 턴" 을 고를 때 쓴다(scripts/list-ai-activity.mjs --run).
  __oprnAiActivityRunId?: () => string;
  // 원격 전송 실패분 큐 — 조용한 유실을 드러내기 위한 진단 표면(src/project/remoteOutbox.ts).
  __oprnRemoteOutbox?: () => unknown;
  __oprnFlushRemoteOutbox?: () => Promise<unknown>;
  // AI 하네스 스냅샷(주입 포함 원본 메시지 + 감사 로그) — 콘솔/헤드리스 디버깅용.
  __oprnAiHarness?: () => unknown;
  // 에디터 beginner/standard/expert UI 모드 (src/editor/editorUiMode.ts).
  __oprnEditorUiMode?: {
    readonly get: () => "beginner" | "standard" | "expert";
    readonly set: (mode: "beginner" | "standard" | "expert") => void;
    readonly chrome: () => unknown;
    readonly brand: string;
    readonly storageKey: string;
  };
  // MCP/에이전트 브리지 — 라이브 채팅 패널과 같은 세션 (src/editor/aiAssistantBridge.ts).
  __oprnAiBridge?: {
    readonly send: (text: string) => Promise<unknown>;
    readonly status: () => unknown;
    readonly audit: () => unknown;
    readonly harness: () => unknown;
    readonly abort: () => void;
    readonly connected: () => boolean;
  };
  // DB 모달 인라인 AI 바의 마지막 전송 요청 — E2E가 실 LLM 호출 없이 전송 도달을 검증.
  __oprnDbAiLastRequest?: { readonly message: string; readonly at: string };
  __oprnCamera?: () => OprnCameraDebug;
  __oprnJuiceLog?: () => readonly OprnRuntimeJuiceLogEntry[];
  __oprnInput?: {
    readonly action: () => void;
    readonly dir: (direction: string | null) => void;
  };
  __oprnPlayerSprite?: () => OprnPlayerSpriteDebug | null;
  __oprnRuntimeJuice?: { readonly log: OprnRuntimeJuiceLogEntry[] };
  __oprnSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
}
