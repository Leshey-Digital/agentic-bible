import { InputError } from '../editorial/validation.ts';

export const groups = ['google', 'clarity', 'privacy', 'advertising'] as const;
export type Group = typeof groups[number];
export type Values = {
  google: { tagId: string; ga4Id: string; enabled: boolean };
  clarity: { projectId: string; enabled: boolean };
  privacy: { previewEnabled: boolean; analyticsConsent: 'denied'; adConsent: 'denied'; respectDnt: true };
  advertising: { enabled: false };
};
export const defaults: Values = {
  google: { tagId: '', ga4Id: '', enabled: false },
  clarity: { projectId: '', enabled: false },
  privacy: { previewEnabled: false, analyticsConsent: 'denied', adConsent: 'denied', respectDnt: true },
  advertising: { enabled: false },
};
export type Setting<G extends Group = Group> = { group: G; values: Values[G]; version: number; updatedAt: number };
export type Settings = { [G in Group]: Setting<G> };
export type Update = { group: Group; values: Values[Group]; version: number; requestKey: string };
export type SettingAudit = { actor: string; group: Group; version: number; fields: string[]; createdAt: number };
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const fieldsFor = (group: Group) => Object.keys(defaults[group]);
export function validateValues<G extends Group>(group: G, input: unknown): Values[G] {
  const errors: Record<string, string> = {};
  if (!record(input) || Object.keys(input).some(key => !fieldsFor(group).includes(key)) || fieldsFor(group).some(key => !(key in input))) throw new InputError({ form: 'Use only the listed non-secret settings. Scripts and credentials are not accepted.' });
  const data = input as Record<string, unknown>;
  for (const key of fieldsFor(group)) {
    const example = (defaults[group] as unknown as Record<string, unknown>)[key];
    if (typeof data[key] !== typeof example) errors[key] = 'Use the expected setting type.';
  }
  const id = (key: string, pattern: RegExp, hint: string) => {
    if (typeof data[key] !== 'string' || data[key].length > 24 || data[key] !== data[key].trim() || (data[key] !== '' && !pattern.test(data[key] as string))) errors[key] = hint;
  };
  if (group === 'google') {
    id('tagId', /^(?:GT|G)-[A-Z0-9]{4,20}$/, 'Use a GT- or G- identifier, or leave empty. Containers, ad IDs and scripts are not accepted.');
    id('ga4Id', /^G-[A-Z0-9]{10}$/, 'Use a GA4 G- identifier with ten letters or digits, or leave empty.');
    if (data.enabled === true && !data.tagId && !data.ga4Id) errors.enabled = 'Enter a Google identifier before selecting it for the preview.';
  }
  if (group === 'clarity') {
    id('projectId', /^[a-z0-9]{4,20}$/, 'Use 4–20 lowercase letters or digits from the Clarity project ID, or leave empty.');
    if (data.enabled === true && !data.projectId) errors.enabled = 'Enter a Clarity project ID before selecting it for the preview.';
  }
  if (group === 'privacy') {
    if (data.analyticsConsent !== 'denied') errors.analyticsConsent = 'Analytics consent must default to denied.';
    if (data.adConsent !== 'denied') errors.adConsent = 'Advertising consent must default to denied.';
    if (data.respectDnt !== true) errors.respectDnt = 'Do Not Track protection must remain enabled.';
  }
  if (group === 'advertising' && data.enabled !== false) errors.enabled = 'Advertising is locked off until a separate reviewed activation.';
  if (Object.keys(errors).length) throw new InputError(errors);
  // Project only allowlisted fields; no secret or arbitrary property can be retained.
  return Object.fromEntries(fieldsFor(group).map(key => [key, data[key]])) as Values[G];
}
export function updateInput(input: unknown): Update {
  if (!record(input) || Object.keys(input).some(key => !['group','values','version','requestKey'].includes(key))) throw new InputError({ form: 'Send only the supplied settings fields. Credentials and raw scripts are not settings.' });
  if (!(groups as readonly unknown[]).includes(input.group)) throw new InputError({ group: 'Choose a settings section.' });
  const group = input.group as Group;
  const version = typeof input.version === 'string' && /^[1-9]\d*$/.test(input.version) ? Number(input.version) : input.version;
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw new InputError({ version: 'Reload the current revision before saving.' });
  if (typeof input.requestKey !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestKey)) throw new InputError({ requestKey: 'Reload the controls to obtain a request reference.' });
  return { group, values: validateValues(group, input.values), version: version as number, requestKey: input.requestKey };
}
