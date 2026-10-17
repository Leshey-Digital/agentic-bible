// Shared by the actual SEO preview and its cold-cache CLI regression.
export const seoPreviewEnvironment=(configHome,cacheHome)=>({PATH:process.env.PATH,WRANGLER_SEND_METRICS:'false',WRANGLER_HIDE_BANNER:'true',CLOUDFLARE_CF_FETCH_ENABLED:'false',XDG_CONFIG_HOME:configHome,XDG_CACHE_HOME:cacheHome});
