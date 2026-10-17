import { defineConfig } from 'astro/config';
import {fileURLToPath} from 'node:url';
import {articleSource,sourceIntegration} from './src/release/source.ts';
import {discoveryPolicy} from './src/seo/policy.ts';
import {discoveryIntegration} from './src/seo/build.ts';
const discovery=discoveryPolicy();

export default defineConfig({
  site: discovery.origin,
  integrations:[discoveryIntegration(discovery),sourceIntegration(articleSource(fileURLToPath(new URL('.',import.meta.url))))],
  output: 'static',
  vite: { build: { assetsInlineLimit: 0 } },
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
});
