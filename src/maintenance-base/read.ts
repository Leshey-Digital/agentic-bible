import {maintenanceTarget} from '../maintenance-quality/target.ts';
import {readCanonicalMaintenance} from '../maintenance-history/canonical.ts';
import {restoreReceiptReference} from '../maintenance-restore/contracts.ts';
import {ownedGit} from '../maintenance-restore/git.ts';
import {projectFiles} from '../wiki-bridge/files.ts';
import {sha,blobSha} from '../maintenance-github/contracts.ts';
import {stop} from '../wiki-bridge/maintenance-provider.ts';
import type {CanonicalBase} from './contracts.ts';
export type CanonicalBasePort={kind:'controlled-canonical-base-fixture';repo:string;sourceCommit:string};
// Explicit trusted local port only; no request JSON, fetch, credential or default adapter.
export function readMaintenanceSource(port:CanonicalBasePort,projectRepo:string,requireCurrent=false,articleId='tool-use'){
 if(!port||port.kind!=='controlled-canonical-base-fixture'||typeof port.repo!=='string'||!sha(port.sourceCommit)||Object.keys(port).sort().join(',')!=='kind,repo,sourceCommit')stop('maintenance_canonical_base_required');
 const git=ownedGit(port.repo),current=()=>{if(git(['rev-parse','refs/heads/main']).toString().trim()!==port.sourceCommit)stop('maintenance_stale_canonical_base');};if(requireCurrent)current();
 const target=maintenanceTarget(articleId);const view=readCanonicalMaintenance({mode:'controlled-static-preview',repo:port.repo,sourceCommit:port.sourceCommit});
 if(requireCurrent&&view.history.length>=16)stop('maintenance_canonical_history_capacity');
 const maintained=new Map(view.history.filter(e=>e.current).map(e=>[maintenanceTarget(e.articleId).articlePath,e]));const project=projectFiles(projectRepo),entries=git(['ls-tree','-r','-z',port.sourceCommit]).toString().split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t'),[mode,type,oid]=meta.split(' ');return {mode,type,oid,path};});if(entries.length>1024)stop('maintenance_canonical_code_conflict');const tree=new Map(entries.map(e=>[e.path,e]));
 for(const [path,bytes]of Object.entries(project.files)){if(path===target.articlePath||maintained.has(path))continue;const e=tree.get(path);if(!e||e.mode!=='100644'||e.type!=='blob'||e.oid!==blobSha(bytes))stop('maintenance_canonical_code_conflict');}
 for(const e of entries)if((e.path.startsWith('src/')||e.path.startsWith('public/'))&&!(e.path in project.files)&&![...maintained.values()].some(head=>maintenanceTarget(head.articleId).pointerPath===e.path)&&!/^src\/content\/maintenance\/history\/[a-f0-9]{64}\.json$/.test(e.path))stop('maintenance_canonical_code_conflict');
 if(requireCurrent)current();return {view};
}
export function readMaintenanceBase(port:CanonicalBasePort,projectRepo:string,requireCurrent=false,articleId='tool-use',optional=false){
 const {view}=readMaintenanceSource(port,projectRepo,requireCurrent,articleId),head=view.history.find(e=>e.current&&e.articleId===articleId);if(!head){if(optional)return undefined;stop('maintenance_canonical_receipt_required');}
 const metadata:CanonicalBase={schemaVersion:1,kind:'controlled-canonical-maintenance-base',sourceCommit:port.sourceCommit,receipt:restoreReceiptReference(head.receipt)};return {metadata,markdown:head.markdown};
}
