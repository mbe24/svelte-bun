import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Add Node.js compatibility for built-in modules
			platformProxy: {
				configPath: 'wrangler.toml'
			}
		})
	}
};

export default config;
