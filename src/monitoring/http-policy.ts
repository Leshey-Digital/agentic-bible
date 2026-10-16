import {BlockList,isIP} from 'node:net';

export {httpSources,httpLimits,officialSource,officialUrl} from './http-registry.ts';
export type PublicAddress={address:string;family:4|6};
const denied=new BlockList();
for(const [address,prefix] of [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],
  ['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],
  ['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4],['168.63.129.16',32],
] as const)denied.addSubnet(address,prefix,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
for(const [address,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)denied.addSubnet(address,prefix,'ipv6');

export function publicAddress(value:unknown):value is PublicAddress {
  if(!value||typeof value!=='object')return false;
  const {address,family}=value as PublicAddress;
  if(typeof address!=='string'||address.includes('%')||isIP(address)!==family)return false;
  if(family===4)return !denied.check(address,'ipv4');
  return family===6&&globalV6.check(address,'ipv6')&&!denied.check(address,'ipv6');
}
