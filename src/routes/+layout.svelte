<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { initPostHogClient, getPostHogClient } from '$lib/posthog-client';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Initialize PostHog client on mount with data from server
	onMount(() => {
		if (browser && data?.posthog?.apiKey) {
			initPostHogClient(data.posthog.apiKey, data.posthog.host || undefined);
		}
	});

	// Track page views when route changes
	$effect(() => {
		if (browser && $page.url) {
			const posthog = getPostHogClient();
			if (posthog) {
				posthog.capture('$pageview', {
					$current_url: $page.url.href
				});
			}
		}
	});
</script>

<svelte:head>
	<title>SvelteKit + Bun App</title>
</svelte:head>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
			Cantarell, 'Helvetica Neue', sans-serif;
		background: #f5f5f5;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
