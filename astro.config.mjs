import { defineConfig } from 'astro/config';
import {discoveryPolicy} from './src/seo/policy.ts';
import {discoveryIntegration} from './src/seo/build.ts';
const discovery=discoveryPolicy();

export default defineConfig({
  site: discovery.origin,
  integrations:[discoveryIntegration(discovery)],
  output: 'static',
  vite: { build: { assetsInlineLimit: 0 } },
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
});
