/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOGETHER_API_KEY: string
  readonly VITE_REMOVEBG_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 