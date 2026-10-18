import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
// Nonblocking/no-follow comes before fstat: opening a FIFO must not suspend an
// otherwise bounded release. Read at most max+1 even if a file grows after fstat.
export function readReleaseFile(path:string,max:number){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size>max)throw Error('release_file_rejected');const data=Buffer.alloc(max+1);let size=0;while(size<data.length){const count=readSync(fd,data,size,data.length-size,null);if(!count)break;size+=count;}if(size>max)throw Error('release_file_capacity');return data.subarray(0,size);}finally{closeSync(fd);}
}
