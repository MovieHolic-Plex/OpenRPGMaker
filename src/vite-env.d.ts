interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_YUNWU_API_KEY?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_API_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_TOUCH_CONTROLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


type RpgZzuPlayerSpriteDebug = {
  readonly textureKey: string;
  readonly frame: string | number;
  readonly resourceId: string;
  readonly kind: string;
  readonly moving: boolean;
  readonly x: number;
  readonly y: number;
};

type RpgZzuRuntimeJuiceEvent =
  | "menu-back"
  | "menu-close"
  | "menu-confirm"
  | "menu-invalid"
  | "menu-open"
  | "menu-select"
  | "title-confirm"
  | "title-enter"
  | "title-select";

type RpgZzuRuntimeJuiceLogEntry = {
  readonly event: RpgZzuRuntimeJuiceEvent;
  readonly soundResourceId: string;
  readonly motionClass: string;
  readonly durationMs: number;
};

type RpgZzuCameraDebug = {
  readonly height: number;
  readonly width: number;
  readonly zoom: number;
};

interface Window {
  __RPG_ZZU_E2E_PROJECT__?: unknown;
  __rpgzzuProjectE2E?: import("@/editor/editorToolHook").ProjectE2EBridge;
  // 영역 작업 마지막 로그 export (감사·툴·하네스) — 콘솔/헤드리스 디버깅용.
  __rpgzzuRegionTaskLog?: unknown;
  __rpgzzuLastRegionTaskLog?: () => unknown;
  // 영역 작업 승인 게이트 pending (get/apply/discard) — E2E·디버깅용.
  __rpgzzuRegionTaskPending?: {
    get: () => unknown;
    apply: () => void;
    discard: () => void;
  };
  // AI 활동 로그 링버퍼 (채팅·영역 등) — localStorage + optional Supabase.
  __rpgzzuAiActivityLog?: unknown;
  __rpgzzuListAiActivityLogs?: (limit?: number) => readonly unknown[];
  __rpgzzuGetAiActivityLog?: (id: string) => unknown;
  __rpgzzuClearAiActivityLogs?: () => void;
  __rpgzzuExportAiActivityLogs?: (limit?: number) => string;
  // AI 하네스 스냅샷(주입 포함 원본 메시지 + 감사 로그) — 콘솔/헤드리스 디버깅용.
  __rpgzzuAiHarness?: () => unknown;
  // 에디터 basic/expert UI 모드 (src/editor/editorUiMode.ts).
  __rpgzzuEditorUiMode?: {
    readonly get: () => "basic" | "expert";
    readonly set: (mode: "basic" | "expert") => void;
    readonly chrome: () => unknown;
    readonly brand: string;
    readonly storageKey: string;
  };
  // MCP/에이전트 브리지 — 라이브 채팅 패널과 같은 세션 (src/editor/aiAssistantBridge.ts).
  __rpgzzuAiBridge?: {
    readonly send: (text: string) => Promise<unknown>;
    readonly status: () => unknown;
    readonly audit: () => unknown;
    readonly harness: () => unknown;
    readonly abort: () => void;
    readonly connected: () => boolean;
  };
  // DB 모달 인라인 AI 바의 마지막 전송 요청 — E2E가 실 LLM 호출 없이 전송 도달을 검증.
  __rpgzzuDbAiLastRequest?: { readonly message: string; readonly at: string };
  __rpgzzuCamera?: () => RpgZzuCameraDebug;
  __rpgzzuJuiceLog?: () => readonly RpgZzuRuntimeJuiceLogEntry[];
  __rpgzzuInput?: {
    readonly action: () => void;
    readonly dir: (direction: string | null) => void;
  };
  __rpgzzuPlayerSprite?: () => RpgZzuPlayerSpriteDebug | null;
  __rpgzzuRuntimeJuice?: { readonly log: RpgZzuRuntimeJuiceLogEntry[] };
  __rpgzzuSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
}
