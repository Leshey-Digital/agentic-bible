export async function responseBytes(response:Response,max:number){
 if(Number(response.headers.get('content-length'))>max){void response.body?.cancel();throw Error('release_response_capacity');}const reader=response.body?.getReader();if(!reader)throw Error('release_response_body');let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max){void reader.cancel();throw Error('release_response_capacity');}chunks.push(next.value);}}finally{reader.releaseLock();}
 const value=new Uint8Array(size);let offset=0;for(const chunk of chunks){value.set(chunk,offset);offset+=chunk.length;}return value;
}
export const responseJson=async(response:Response,max=262144)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await responseBytes(response,max)));
