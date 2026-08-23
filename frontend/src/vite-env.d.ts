/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEFAULT_ORGANIZATION_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

