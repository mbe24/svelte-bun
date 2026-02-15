// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId?: number;
			telemetryContext?: {
				userId?: number;
				sessionId?: string;
				distinctId?: string;
				ipAddress?: string;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// Define Platform interface for Cloudflare Workers compatibility
		interface Platform {
			env?: {
				DATABASE_URL?: string;
				POSTHOG_API_KEY?: string;
				POSTHOG_HOST?: string;
				POSTHOG_OTLP_HOST?: string;
				// Add other environment variables as needed
			};
			context?: {
				waitUntil(promise: Promise<any>): void;
			};
		}
	}
}

export {};
