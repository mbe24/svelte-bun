<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		error = '';

		if (!username || !password || !confirmPassword) {
			error = 'All fields are required';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			const data = await response.json();

			if (response.ok) {
				goto('/counter');
			} else {
				error = data.error || 'Registration failed';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="container">
	<div class="form-card">
		<h1>Register</h1>
		<p class="subtitle">Create a new account</p>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="form-group">
				<label for="username">Username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					placeholder="Enter username"
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="Enter password"
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label for="confirm-password">Confirm Password</label>
				<input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					placeholder="Confirm password"
					disabled={loading}
				/>
			</div>

			{#if error}
				<div class="error" data-testid="register-error">{error}</div>
			{/if}

			<button type="submit" class="button-primary" disabled={loading}>
				{loading ? 'Registering...' : 'Register'}
			</button>
		</form>

		<p class="link-text">
			Already have an account? <a href="/login">Login here</a>
		</p>
	</div>
</div>

<style>
	.container {
		max-width: 400px;
		margin: 4rem auto;
		padding: 2rem;
	}

	.form-card {
		background: white;
		padding: 2rem;
		border-radius: 1rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
		text-align: center;
	}

	.subtitle {
		color: #666;
		text-align: center;
		margin-bottom: 2rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		color: #333;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #ddd;
		border-radius: 0.5rem;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #ff3e00;
	}

	input:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.error {
		background: #fee;
		color: #c33;
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		text-align: center;
	}

	.button-primary {
		width: 100%;
		padding: 0.75rem;
		background: #ff3e00;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.button-primary:hover:not(:disabled) {
		background: #ff5722;
	}

	.button-primary:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.link-text {
		text-align: center;
		margin-top: 1.5rem;
		color: #666;
	}

	.link-text a {
		color: #ff3e00;
		text-decoration: none;
	}

	.link-text a:hover {
		text-decoration: underline;
	}
</style>
