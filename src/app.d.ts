// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId?: number;
		}
		// interface PageData {}
		// interface PageState {}
		// Define Platform interface for Cloudflare Workers compatibility
		interface Platform {
			env?: {
				DATABASE_URL?: string;
				// Add other environment variables as needed
			};
		}
	}
}

export {};
