/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_SEO_INDEXABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
