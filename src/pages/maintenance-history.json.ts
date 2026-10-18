import {maintenanceCatalog} from '../maintenance-history/build.ts';
export function GET(){return new Response(JSON.stringify(maintenanceCatalog())+'\n',{headers:{'Content-Type':'application/json','X-Robots-Tag':'noindex, nofollow'}});}
