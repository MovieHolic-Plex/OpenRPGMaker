interface ImportMetaEnv {
  readonly VITE_YUNWU_API_KEY?: string;
  readonly VITE_LLM_API_KEY?: string;
  readonly VITE_LLM_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
