import {registerHooks} from 'node:module';
import {writeFileSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){if(specifier==='astro'||specifier==='pagefind'){writeFileSync(process.env.WIKI_GUARD_IMPORT_MARKER,'heavy import attempted');throw Error('heavy import reached before owner rejection');}return next(specifier,context);}});
