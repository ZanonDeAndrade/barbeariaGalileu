/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_KEEP_BACKEND_ALIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
