export function socialImageUrl(image:unknown,origin:string):string|null{
  if(image===undefined)return null;
  if(typeof image!=='string'||!/^\/(?!\/)[A-Za-z0-9/_-]+\.(?:png|jpe?g|webp)$/.test(image))throw new Error('invalid_social_image');
  if(origin!=='https://staging.agenticbible.si'&&origin!=='https://agenticbible.si')throw new Error('invalid_social_origin');
  return new URL(image,origin).href;
}
