import { defineConfig } from 'vite';
import vinext from 'vinext';
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.WRANGLER_REGISTRY_PATH ??= '.wrangler/dev-registry';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const {cloudflare}=await import('@cloudflare/vite-plugin');
  return {plugins:[vinext(),cloudflare({configPath:'wrangler.jsonc',viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false})]};
});
