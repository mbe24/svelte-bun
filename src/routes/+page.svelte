<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/counter');
			if (response.ok) {
				// User is authenticated, redirect to counter
				goto('/counter');
			} else {
				loading = false;
			}
		} catch (error) {
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="container">
		<p>Loading...</p>
	</div>
{:else}
	<div class="container">
		<h1>Welcome to SvelteKit + Bun</h1>
		<p>A simple web application with authentication and counter functionality.</p>

		<div class="buttons">
			<a href="/login" class="button">Login</a>
			<a href="/register" class="button button-primary">Register</a>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		text-align: center;
	}

	h1 {
		color: #333;
		margin-bottom: 1rem;
	}

	p {
		color: #666;
		margin-bottom: 2rem;
	}

	.buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.button {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s;
		border: 2px solid #ddd;
		color: #333;
		background: white;
	}

	.button:hover {
		border-color: #999;
	}

	.button-primary {
		background: #ff3e00;
		color: white;
		border-color: #ff3e00;
	}

	.button-primary:hover {
		background: #ff5722;
		border-color: #ff5722;
	}
</style>
