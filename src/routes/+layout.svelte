<script lang="ts">
	let { children } = $props();
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
