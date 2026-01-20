/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_STORE_BUILD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}