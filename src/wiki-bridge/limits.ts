export const bridgeLimits=Object.freeze({inputBytes:49152,sourceBytes:32768,sources:3,projectBytes:8*1024*1024,siteBytes:16*1024*1024,storeBytes:192*1024*1024,operations:8,buildAttempts:3});
export class BridgeError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function reject(code:string):never{throw new BridgeError(code);}
