import type { SqlDatabase } from '../editorial/contracts.ts';
import { digest, CapacityError, ReplayConflictError } from '../editorial/validation.ts';
import { groups, validateValues, type Group, type Settings, type SettingAudit, type Update } from './contracts.ts';
import { receiptLimits, SettingsReceiptCapacityError, validateReceiptResponse } from './receipts.ts';

export type SettingsResult='saved'|'duplicate'|'stale'|'unchanged';
export type SettingsOutcome={result:SettingsResult;response?:string};

export class SettingsStore {
  db: SqlDatabase;
  constructor(db: SqlDatabase) { this.db=db; }
  async read(): Promise<Settings> {
    const result = {} as Settings;
    for (const group of groups) {
      const row = await this.db.prepare('SELECT values_json,version,updated_at FROM measurement_settings WHERE setting_group=?').bind(group).first<{values_json:string;version:number;updated_at:number}>();
      if (!row || !Number.isSafeInteger(row.version) || row.version < 1) throw new Error('settings_unavailable');
      Object.assign(result, { [group]: { group, values: validateValues(group, JSON.parse(row.values_json)), version: row.version, updatedAt: row.updated_at } });
    }
    return result;
  }
  async audit(): Promise<SettingAudit[]> {
    const { results } = await this.db.prepare('SELECT actor,setting_group,version,fields_json,created_at FROM measurement_audit ORDER BY created_at DESC,id DESC LIMIT 30').all<{actor:string;setting_group:Group;version:number;fields_json:string;created_at:number}>();
    return results.map(row => ({ actor:row.actor,group:row.setting_group,version:row.version,fields:JSON.parse(row.fields_json),createdAt:row.created_at }));
  }
  async state(){return {settings:await this.read(),audit:await this.audit(),trackingEnabled:false,secretsStatus:'unavailable',adsEnabled:false};}
  async update(input:Update,actor:string,now:number):Promise<SettingsResult>{return (await this.commit(input,actor,now)).result;}
  async commit(input: Update, actor: string, now: number): Promise<SettingsOutcome> {
    const fingerprint = await digest(JSON.stringify({group:input.group,values:input.values,version:input.version}));
    // Only expired no-op receipts are removed; changed-write audit/replay records are never deleted here.
    await this.db.prepare('DELETE FROM measurement_request_receipts WHERE expires_at<=?').bind(now).run();
    const replayed=async():Promise<SettingsOutcome|null>=>{
      const receipt=await this.db.prepare('SELECT fingerprint,response_json FROM measurement_request_receipts WHERE actor=? AND request_key=?').bind(actor,input.requestKey).first<{fingerprint:string;response_json:string}>();
      if(receipt){
        if(receipt.fingerprint!==fingerprint)throw new ReplayConflictError();
        validateReceiptResponse(receipt.response_json);
        return {result:'unchanged',response:receipt.response_json};
      }
      const audit=await this.db.prepare('SELECT fingerprint FROM measurement_audit WHERE actor=? AND request_key=?').bind(actor,input.requestKey).first<{fingerprint:string}>();
      if(audit){if(audit.fingerprint!==fingerprint)throw new ReplayConflictError();return {result:'duplicate'};}
      return null;
    };
    const prior=await replayed();if(prior)return prior;
    const current = (await this.read())[input.group];
    if (current.version !== input.version) return await replayed()??{result:'stale'};
    const before = current.values as unknown as Record<string, unknown>;
    const after = input.values as unknown as Record<string, unknown>;
    const fields = Object.keys(after).filter(key => after[key] !== before[key]);
    if (!fields.length){
      const response=JSON.stringify({...await this.state(),result:'unchanged'});
      validateReceiptResponse(response);
      // The CAS and cross-table key check linearize no-ops against changed writes without changing history.
      await this.db.prepare(`INSERT INTO measurement_request_receipts(actor,request_key,fingerprint,response_json,created_at,expires_at)
        SELECT ?,?,?,?,?,? FROM measurement_settings WHERE setting_group=? AND version=?
        AND (SELECT COUNT(*) FROM measurement_request_receipts)<?
        AND NOT EXISTS(SELECT 1 FROM measurement_audit WHERE actor=? AND request_key=?)
        ON CONFLICT(actor,request_key) DO NOTHING`)
        .bind(actor,input.requestKey,fingerprint,response,now,now+receiptLimits.windowMs,input.group,input.version,receiptLimits.count,actor,input.requestKey).run();
      const saved=await replayed();if(saved)return saved;
      if((await this.read())[input.group].version!==input.version)return {result:'stale'};
      const count=await this.db.prepare('SELECT COUNT(*) AS n FROM measurement_request_receipts').first<{n:number}>();
      if(count&&count.n>=receiptLimits.count)throw new SettingsReceiptCapacityError();
      throw new Error('settings_receipt_unavailable');
    }
    const count = await this.db.prepare('SELECT COUNT(*) AS n FROM measurement_audit').first<{n:number}>();
    if (!count || count.n >= 1000) throw new CapacityError();
    const id = crypto.randomUUID();
    // Insert the unique next revision first. A collision rolls back the batch before the CAS update.
    try {
      const result = await this.db.batch([
        this.db.prepare('INSERT INTO measurement_audit(id,actor,setting_group,version,fields_json,created_at,request_key,fingerprint) SELECT ?,?,?,version+1,?,?,?,? FROM measurement_settings WHERE setting_group=? AND version=? AND (SELECT COUNT(*) FROM measurement_audit)<1000 AND NOT EXISTS(SELECT 1 FROM measurement_request_receipts WHERE actor=? AND request_key=?)').bind(id,actor,input.group,JSON.stringify(fields),now,input.requestKey,fingerprint,input.group,input.version,actor,input.requestKey),
        this.db.prepare('UPDATE measurement_settings SET values_json=?,version=version+1,updated_at=? WHERE setting_group=? AND version=? AND EXISTS(SELECT 1 FROM measurement_audit WHERE id=?)').bind(JSON.stringify(input.values),now,input.group,input.version,id),
      ]);
      if (result[1].meta.changes === 1) return {result:'saved'};
      const replay=await replayed();if(replay)return replay;
      if ((await this.db.prepare('SELECT COUNT(*) AS n FROM measurement_audit').first<{n:number}>())!.n >= 1000) throw new CapacityError();
      return {result:'stale'};
    } catch (error) {
      const replay=await replayed();if(replay)return replay;
      if ((await this.read())[input.group].version !== input.version) return {result:'stale'};
      throw error;
    }
  }
}
