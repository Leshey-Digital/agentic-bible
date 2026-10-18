import type {SqlDatabase} from '../editorial/contracts.ts';
import {WikiBridge,type SiteReceipt,type BridgePhase} from '../wiki-bridge/store.ts';
import {approve,operation,complete,uuid,reject,type ReviewInput} from './approval.ts';
export class CorrectionCoordinator{
  bridge:WikiBridge;db:SqlDatabase;
  constructor(db:SqlDatabase,name='wiki-bridge-corrections-local'){this.db=db;this.bridge=new WikiBridge(name);}
  async apply(input:ReviewInput,reviewer:string,checkpoint?:(phase:BridgePhase)=>void|Promise<void>){const op=await approve(this.db,this.bridge,input,reviewer);return this.retry(op.id,reviewer,checkpoint);}
  async retry(id:string,reviewer:string,checkpoint?:(phase:BridgePhase)=>void|Promise<void>):Promise<SiteReceipt>{
    if(reviewer!=='local-editor'||!uuid(id))reject('admin_review_required');const op=await operation(this.db,id);if(!op||op.reviewer!==reviewer)reject('approval_required');
    if(op.state==='complete'){const receipt=JSON.parse(op.receipt_json!);this.bridge.load(receipt.site);return receipt;}
    const receipt=await this.bridge.executeReviewed(id,this.db,{checkpoint});await complete(this.db,op,receipt);return receipt;
  }
}
