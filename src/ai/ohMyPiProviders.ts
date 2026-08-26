// oh-my-pi (`@oh-my-pi/pi-catalog` CATALOG_PROVIDERS, 2026-08-20 descriptors.ts) 와
// 같은 제공자 id 집합. 로그인/키 변수/기본 모델만 들고, 시크릿은 넣지 않는다.
// 브라우저 설정·동반 서비스·단위 테스트가 이 목록을 공유한다.

export type OhMyPiAuthKind = "oauth" | "apiKey" | "local";

export type OhMyPiProvider = {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  readonly envVars: readonly string[];
  readonly authKind: OhMyPiAuthKind;
};

const OAUTH_IDS = new Set([
  "anthropic",
  "cursor",
  "devin",
  "github-copilot",
  "google-antigravity",
  "google-gemini-cli",
  "kilo",
  "kimi-code",
  "ollama-cloud",
  "openai-codex",
  "qwen-portal",
  "umans",
  "wafer-serverless",
  "xai-oauth",
]);

const LOCAL_IDS = new Set(["google-vertex", "lm-studio", "ollama", "vllm"]);

function kindOf(id: string): OhMyPiAuthKind {
  if (OAUTH_IDS.has(id)) return "oauth";
  if (LOCAL_IDS.has(id)) return "local";
  return "apiKey";
}

function row(
  id: string,
  label: string,
  defaultModel: string,
  envVars: readonly string[] = [],
): OhMyPiProvider {
  return { id, label, defaultModel, envVars, authKind: kindOf(id) };
}

/** oh-my-pi KnownProvider 와 같은 id 집합. 순서는 카탈로그 원본과 같다. */
export const OH_MY_PI_PROVIDERS: readonly OhMyPiProvider[] = [
  row("aiand", "ai&", "moonshotai/kimi-k2.7-code", ["AIAND_API_KEY"]),
  row("aimlapi", "AIML API", "gpt-5.5-2026-04-23", ["AIMLAPI_API_KEY"]),
  row("alibaba-coding-plan", "Alibaba Coding Plan", "qwen3.7-plus", ["ALIBABA_CODING_PLAN_API_KEY"]),
  row("alibaba-token-plan", "QwenCloud Token Plan", "qwen3.7-plus", ["ALIBABA_TOKEN_PLAN_API_KEY", "BAILIAN_TOKEN_PLAN_API_KEY"]),
  row("baseten", "Baseten", "moonshotai/Kimi-K2.7-Code", ["BASETEN_API_KEY"]),
  row("amazon-bedrock", "Amazon Bedrock", "us.anthropic.claude-opus-4-8"),
  row("bedrock-mantle", "Bedrock Mantle", "openai.gpt-5.6-terra", ["AWS_BEARER_TOKEN_BEDROCK"]),
  row("anthropic", "Anthropic", "claude-opus-4-8", ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"]),
  row("azure", "Azure OpenAI", "gpt-5.5", ["AZURE_OPENAI_API_KEY"]),
  row("cerebras", "Cerebras", "zai-glm-4.7", ["CEREBRAS_API_KEY"]),
  row("cloudflare-ai-gateway", "Cloudflare AI Gateway", "anthropic/claude-opus-4-8", ["CLOUDFLARE_AI_GATEWAY_API_KEY"]),
  row("cursor", "Cursor", "claude-4.6-opus-high", ["CURSOR_ACCESS_TOKEN", "CURSOR_API_KEY"]),
  row("deepseek", "DeepSeek", "deepseek-v4-pro", ["DEEPSEEK_API_KEY"]),
  row("devin", "Devin", "swe-1-6", ["DEVIN_API_KEY"]),
  row("firepass", "Firepass", "kimi-k2.6-turbo", ["FIREPASS_API_KEY"]),
  row("fireworks", "Fireworks", "kimi-k2.7-code", ["FIREWORKS_API_KEY"]),
  row("github-copilot", "GitHub Copilot", "gpt-5.5", ["COPILOT_GITHUB_TOKEN"]),
  row("gitlab-duo", "GitLab Duo", "duo-chat-opus-4-6", ["GITLAB_TOKEN"]),
  row("gitlab-duo-agent", "GitLab Duo Agent", "claude_sonnet_4_6_vertex", ["GITLAB_TOKEN"]),
  row("gmi-cloud", "GMI Cloud", "deepseek-ai/DeepSeek-V4-Flash", ["GMI_API_KEY"]),
  row("google", "Google Gemini", "gemini-3.1-pro-preview", ["GEMINI_API_KEY"]),
  row("google-antigravity", "Google Antigravity", "gemini-3.7-flash-high"),
  row("google-gemini-cli", "Google Gemini CLI", "gemini-3.1-pro-preview"),
  row("google-vertex", "Google Vertex", "gemini-3.1-pro-preview", ["GOOGLE_CLOUD_API_KEY"]),
  row("groq", "Groq", "openai/gpt-oss-120b", ["GROQ_API_KEY"]),
  row("huggingface", "Hugging Face", "deepseek-ai/DeepSeek-R1", ["HUGGINGFACE_HUB_TOKEN", "HF_TOKEN"]),
  row("kilo", "Kilo Gateway", "anthropic/claude-opus-4.8", ["KILO_API_KEY"]),
  row("kimi-code", "Kimi Code", "kimi-for-coding", ["KIMI_API_KEY"]),
  row("litellm", "LiteLLM", "claude-opus-4-8", ["LITELLM_API_KEY"]),
  row("lm-studio", "LM Studio", "llama-3-8b", ["LM_STUDIO_API_KEY"]),
  row("minimax", "MiniMax", "MiniMax-M3", ["MINIMAX_API_KEY"]),
  row("minimax-code", "MiniMax Coding Plan", "MiniMax-M3", ["MINIMAX_CODE_API_KEY"]),
  row("minimax-code-cn", "MiniMax Coding Plan CN", "MiniMax-M3", ["MINIMAX_CODE_CN_API_KEY"]),
  row("mistral", "Mistral", "devstral-medium-latest", ["MISTRAL_API_KEY"]),
  row("meta", "Meta Model API", "muse-spark-1.1", ["MODEL_API_KEY", "META_API_KEY"]),
  row("moonshot", "Moonshot", "kimi-k2.7-code", ["MOONSHOT_API_KEY", "KIMI_API_KEY"]),
  row("nanogpt", "NanoGPT", "openai/gpt-5.5", ["NANO_GPT_API_KEY"]),
  row("nvidia", "NVIDIA", "nvidia/llama-3.1-nemotron-70b-instruct", ["NVIDIA_API_KEY"]),
  row("novita", "Novita", "moonshotai/kimi-k2.7-code", ["NOVITA_API_KEY"]),
  row("ollama", "Ollama", "gpt-oss:20b", ["OLLAMA_API_KEY"]),
  row("ollama-cloud", "Ollama Cloud", "gpt-oss:120b", ["OLLAMA_CLOUD_API_KEY"]),
  row("openai", "OpenAI", "gpt-5.5", ["OPENAI_API_KEY"]),
  row("openai-codex", "OpenAI Codex", "gpt-5.5", ["OPENAI_CODEX_OAUTH_TOKEN"]),
  row("opencode-go", "OpenCode Go", "kimi-k2.7-code", ["OPENCODE_API_KEY"]),
  row("opencode-zen", "OpenCode Zen", "claude-opus-4-8", ["OPENCODE_API_KEY"]),
  row("openrouter", "OpenRouter", "openai/gpt-5.5", ["OPENROUTER_API_KEY"]),
  row("qianfan", "Qianfan", "deepseek-v3.2", ["QIANFAN_API_KEY"]),
  row("qwen-portal", "Qwen Portal", "coder-model", ["QWEN_OAUTH_TOKEN", "QWEN_PORTAL_API_KEY"]),
  row("sakana", "Sakana AI", "fugu", ["SAKANA_API_KEY", "FUGU_API_KEY"]),
  row("siliconflow", "SiliconFlow", "zai-org/GLM-5.1", ["SILICONFLOW_API_KEY"]),
  row("siliconflow-cn", "SiliconFlow CN", "deepseek-ai/DeepSeek-V4-Pro", ["SILICONFLOW_CN_API_KEY"]),
  row("synthetic", "Synthetic", "hf:zai-org/GLM-5.1", ["SYNTHETIC_API_KEY"]),
  row("together", "Together", "moonshotai/Kimi-K2.7-Code", ["TOGETHER_API_KEY"]),
  row("umans", "Umans AI Coding Plan", "umans-coder", ["UMANS_AI_CODING_PLAN_API_KEY"]),
  row("venice", "Venice", "llama-3.3-70b", ["VENICE_API_KEY"]),
  row("vercel-ai-gateway", "Vercel AI Gateway", "anthropic/claude-opus-4.8", ["AI_GATEWAY_API_KEY", "VERCEL_AI_GATEWAY_API_KEY"]),
  row("vllm", "vLLM", "gpt-oss-20b", ["VLLM_API_KEY"]),
  row("wafer-serverless", "Wafer Serverless", "GLM-5.1", ["WAFER_SERVERLESS_API_KEY"]),
  row("coreweave", "CoreWeave", "openai/gpt-oss-120b", ["COREWEAVE_API_KEY", "WANDB_API_KEY"]),
  row("xai", "xAI", "grok-4.6", ["XAI_API_KEY"]),
  row("xai-oauth", "xAI Grok OAuth", "grok-4.6", ["XAI_OAUTH_TOKEN", "XAI_API_KEY"]),
  row("xiaomi", "Xiaomi", "mimo-v2.5", ["XIAOMI_API_KEY"]),
  row("xiaomi-token-plan-ams", "Xiaomi Token Plan AMS", "mimo-v2.5", ["XIAOMI_TOKEN_PLAN_AMS_API_KEY"]),
  row("xiaomi-token-plan-cn", "Xiaomi Token Plan CN", "mimo-v2.5", ["XIAOMI_TOKEN_PLAN_CN_API_KEY"]),
  row("xiaomi-token-plan-sgp", "Xiaomi Token Plan SGP", "mimo-v2.5", ["XIAOMI_TOKEN_PLAN_SGP_API_KEY"]),
  row("zai", "zAI", "glm-5.3", ["ZAI_API_KEY"]),
  row("zenmux", "ZenMux", "anthropic/claude-opus-4.8", ["ZENMUX_API_KEY"]),
  row("zhipu-coding-plan", "Zhipu Coding Plan", "glm-5.1", ["ZHIPU_API_KEY"]),
];

export const DEFAULT_OH_MY_PI_PROVIDER = "google-antigravity";

const BY_ID = new Map(OH_MY_PI_PROVIDERS.map((provider) => [provider.id, provider]));

export function getOhMyPiProvider(id: string): OhMyPiProvider | undefined {
  return BY_ID.get(id);
}

export function parseOhMyPiProvider(raw: unknown, fallback = DEFAULT_OH_MY_PI_PROVIDER): string {
  if (typeof raw === "string" && BY_ID.has(raw)) return raw;
  return fallback;
}

export function ohMyPiOAuthProviders(): readonly OhMyPiProvider[] {
  return ohMyPiProvidersByAuthKind("oauth");
}

/**
 * 제공자의 자격 증명 종류. **에디터의 인증 UI 는 이 값 하나로 갈라진다.**
 *
 * 모르는 값·undefined 는 기본 제공자(google-antigravity)의 종류로 떨어진다 — parseOhMyPiProvider 와
 * 같은 관례라 undefined 를 만들지 않는다. 호출부가 옵셔널 체이닝을 잊어 조용히 분기를 놓치는
 * 사고를 막는다(예: `getOhMyPiProvider(id)?.authKind === "oauth"` 는 모르는 id 에서 false 가 되어
 * OAuth 제공자를 API 키처럼 취급했다).
 */
export function ohMyPiAuthKind(providerId: unknown): OhMyPiAuthKind {
  return BY_ID.get(parseOhMyPiProvider(providerId))?.authKind ?? kindOf(DEFAULT_OH_MY_PI_PROVIDER);
}

/**
 * 종류별 사용자 표시 이름. 영어 enum(`"oauth"`)을 한국어 UI 로 흘리지 않기 위한 단일 출처다 —
 * 제공자 선택기가 옵션 텍스트에 `authKind` 를 그대로 붙여 `"Anthropic · oauth"` 로 보이던 것을 대체한다.
 */
export const OH_MY_PI_AUTH_KIND_LABEL: Record<OhMyPiAuthKind, string> = {
  oauth: "구독 로그인",
  apiKey: "API 키",
  local: "로컬 서버",
};

/** 종류별 제공자 목록. 순서는 레지스트리(카탈로그 원본) 순서를 유지한다. */
export function ohMyPiProvidersByAuthKind(kind: OhMyPiAuthKind): readonly OhMyPiProvider[] {
  return OH_MY_PI_PROVIDERS.filter((provider) => provider.authKind === kind);
}
