import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://staging.agenticbible.si',
  output: 'static',
  vite: { build: { assetsInlineLimit: 0 } },
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
});
