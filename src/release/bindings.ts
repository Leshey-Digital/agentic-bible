export const stagingEditorialDatabase={binding:'EDITORIAL_DB',database_name:'agentic-bible-staging-editorial',database_id:'1ca9a6f8-c0a9-4040-8a2f-e22d888a985a'} as const;
export const requiredStagingSecrets=['HOSTED_ADMIN_TRUST','INTEGRATION_VAULT_KEY','INTEGRATION_VAULT_KEY_ID'] as const;
export type RuntimeBinding={name:string;type:string;id?:string};
export const expectedStagingBindings:readonly RuntimeBinding[]=[
 {name:'ASSETS',type:'assets'},
 {name:'EDITORIAL_DB',type:'d1',id:stagingEditorialDatabase.database_id},
 ...requiredStagingSecrets.map(name=>({name,type:'secret_text'})),
];
export const inheritedStagingBindings=[
 {name:'ASSETS',type:'assets'},
 {name:'EDITORIAL_DB',type:'d1',id:stagingEditorialDatabase.database_id},
 ...requiredStagingSecrets.map(name=>({name,type:'inherit'})),
];
export const expectedStagingSettingsBindings=expectedStagingBindings.filter(binding=>binding.name!=='ASSETS');
export function hasExactBindings(actual:unknown,expected:readonly RuntimeBinding[]):boolean{
 if(!Array.isArray(actual)||actual.length!==expected.length)return false;
 const normalize=(rows:readonly RuntimeBinding[])=>rows.map(({name,type,id})=>`${type}\u0000${name}\u0000${id??''}`).sort();
 const observed=normalize(actual as RuntimeBinding[]),pinned=normalize(expected);
 return observed.every((entry,index)=>entry===pinned[index]);
}
