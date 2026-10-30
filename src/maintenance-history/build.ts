import {canonicalMaintenanceCatalog} from './catalog.ts';
import {execFileSync} from 'node:child_process';
import {readCanonicalMaintenance} from './canonical.ts';
// Environment selectors never supply data/receipts. Validate against the same Git source
// used by release/source; disabled child snapshots retain their existing publisher views.
export function maintenanceBuild(){
 const mode=process.env.AGENTIC_BIBLE_MAINTENANCE_HISTORY_MODE;
 if(mode===undefined||mode==='disabled')return readCanonicalMaintenance({repo:'',sourceCommit:''});
 if((process.env.AGENTIC_BIBLE_DISCOVERY_MODE!==undefined&&process.env.AGENTIC_BIBLE_DISCOVERY_MODE!=='staging')||mode!=='controlled-static-preview'||process.env.AGENTIC_BIBLE_LOCAL_WIKI_BUILD==='1')throw Error('history_build_mode_rejected');
 const sourceCommit=process.env.AGENTIC_BIBLE_SOURCE_COMMIT;
 if(!sourceCommit||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sourceCommit)throw Error('history_build_source_pin_required');
 return readCanonicalMaintenance({mode,repo:process.cwd(),sourceCommit});
}
export function maintenanceCatalog(){const view=maintenanceBuild();return canonicalMaintenanceCatalog(view.history,view.enabled,'sourceCommit' in view?view.sourceCommit??null:null);}
