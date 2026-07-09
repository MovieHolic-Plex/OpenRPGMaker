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
  // AI 하네스 스냅샷(주입 포함 원본 메시지 + 감사 로그) — 콘솔/헤드리스 디버깅용.
  __rpgzzuAiHarness?: () => unknown;
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
