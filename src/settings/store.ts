import type { SqlDatabase } from '../editorial/contracts.ts';
import { digest, CapacityError, ReplayConflictError } from '../editorial/validation.ts';
import { groups, validateValues, type Group, type Settings, type SettingAudit, type Update } from './contracts.ts';

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
  async update(input: Update, actor: string, now: number): Promise<'saved'|'duplicate'|'stale'|'unchanged'> {
    const fingerprint = await digest(JSON.stringify({group:input.group,values:input.values,version:input.version}));
    const prior = () => this.db.prepare('SELECT fingerprint FROM measurement_audit WHERE actor=? AND request_key=?').bind(actor,input.requestKey).first<{fingerprint:string}>();
    const replayed = async () => { const replay=await prior(); if (!replay) return false; if (replay.fingerprint!==fingerprint) throw new ReplayConflictError(); return true; };
    if (await replayed()) return 'duplicate';
    const current = (await this.read())[input.group];
    if (current.version !== input.version) return await replayed()?'duplicate':'stale';
    const before = current.values as unknown as Record<string, unknown>;
    const after = input.values as unknown as Record<string, unknown>;
    const fields = Object.keys(after).filter(key => after[key] !== before[key]);
    if (!fields.length) return 'unchanged';
    const count = await this.db.prepare('SELECT COUNT(*) AS n FROM measurement_audit').first<{n:number}>();
    if (!count || count.n >= 1000) throw new CapacityError();
    const id = crypto.randomUUID();
    // Insert the unique next revision first. A collision rolls back the batch before the CAS update.
    try {
      const result = await this.db.batch([
        this.db.prepare('INSERT INTO measurement_audit(id,actor,setting_group,version,fields_json,created_at,request_key,fingerprint) SELECT ?,?,?,version+1,?,?,?,? FROM measurement_settings WHERE setting_group=? AND version=? AND (SELECT COUNT(*) FROM measurement_audit)<1000').bind(id,actor,input.group,JSON.stringify(fields),now,input.requestKey,fingerprint,input.group,input.version),
        this.db.prepare('UPDATE measurement_settings SET values_json=?,version=version+1,updated_at=? WHERE setting_group=? AND version=? AND EXISTS(SELECT 1 FROM measurement_audit WHERE id=?)').bind(JSON.stringify(input.values),now,input.group,input.version,id),
      ]);
      if (result[1].meta.changes === 1) return 'saved';
      if (await replayed()) return 'duplicate';
      if ((await this.db.prepare('SELECT COUNT(*) AS n FROM measurement_audit').first<{n:number}>())!.n >= 1000) throw new CapacityError();
      return 'stale';
    } catch (error) {
      if (await replayed()) return 'duplicate';
      if ((await this.read())[input.group].version !== input.version) return 'stale';
      throw error;
    }
  }
}
