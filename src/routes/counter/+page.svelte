<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let counter = $state(0);
	let loading = $state(true);
	let updating = $state(false);

	onMount(async () => {
		await loadCounter();
	});

	async function loadCounter() {
		try {
			const response = await fetch('/api/counter');
			if (response.ok) {
				const data = await response.json();
				counter = data.value;
			} else {
				goto('/login');
			}
		} catch (error) {
			console.error('Failed to load counter:', error);
		} finally {
			loading = false;
		}
	}

	async function updateCounter(action: 'increment' | 'decrement') {
		if (updating) return;
		
		updating = true;
		try {
			const response = await fetch('/api/counter', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});

			if (response.ok) {
				const data = await response.json();
				counter = data.value;
			} else {
				goto('/login');
			}
		} catch (error) {
			console.error('Failed to update counter:', error);
		} finally {
			updating = false;
		}
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			goto('/');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	}
</script>

<div class="container">
	<div class="header">
		<h1>Counter App</h1>
		<button class="logout-button" onclick={handleLogout}>Logout</button>
	</div>

	{#if loading}
		<div class="loading">Loading...</div>
	{:else}
		<div class="counter-card">
			<div class="counter-display">{counter}</div>

			<div class="button-group">
				<button
					class="counter-button decrement"
					onclick={() => updateCounter('decrement')}
					disabled={updating}
				>
					−
				</button>
				<button
					class="counter-button increment"
					onclick={() => updateCounter('increment')}
					disabled={updating}
				>
					+
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 600px;
		margin: 4rem auto;
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		color: #333;
		margin: 0;
	}

	.logout-button {
		padding: 0.5rem 1rem;
		background: white;
		color: #666;
		border: 2px solid #ddd;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.logout-button:hover {
		border-color: #999;
		color: #333;
	}

	.loading {
		text-align: center;
		color: #666;
		padding: 2rem;
	}

	.counter-card {
		background: white;
		padding: 3rem;
		border-radius: 1rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.counter-display {
		font-size: 6rem;
		font-weight: bold;
		color: #333;
		margin-bottom: 2rem;
		font-variant-numeric: tabular-nums;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.counter-button {
		width: 4rem;
		height: 4rem;
		font-size: 2rem;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		font-weight: bold;
		color: white;
	}

	.counter-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.decrement {
		background: #e74c3c;
	}

	.decrement:hover:not(:disabled) {
		background: #c0392b;
	}

	.increment {
		background: #27ae60;
	}

	.increment:hover:not(:disabled) {
		background: #229954;
	}
</style>
