<script lang="ts">
	import { t } from '#lib/i18n.svelte.ts';
	import type { Color } from '#lib/ldraw.ts';

	interface Target {
		label: string;
		value: number;
		onchange: (code: number) => void;
	}

	let {
		targets,
		colors
	}: {
		targets: Target[];
		colors: Color[];
	} = $props();

	let index = $state(0);
	let all = $state(false);
	let query = $state('');
	const target = $derived(targets[Math.min(index, targets.length - 1)]);
	const current = $derived(colors.find((c) => c.code === target.value));
	const opaque = $derived(colors.filter((c) => !c.alpha));
	const byCode = $derived(new Map(colors.map((c) => [c.code, c])));
	const found = $derived.by(() => {
		const q = query.trim().toLowerCase().replace(/^#/, '');
		if (!q) return opaque;
		return opaque.filter((c) => c.name.toLowerCase().includes(q) || String(c.code) === q);
	});
</script>

{#snippet swatch(c: Color)}
	<button
		type="button"
		class="swatch"
		class:metal={c.finish}
		style:--c={c.hex}
		title="{c.name} ({c.code})"
		aria-label="{c.name} ({c.code})"
		aria-pressed={c.code === target.value}
		onclick={() => target.onchange(c.code)}
	>
		<span class="stud" aria-hidden="true"></span>
	</button>
{/snippet}

<div class="bar">
	<div class="head">
		{#if targets.length > 1}
			<div class="targets" role="tablist" aria-label={t('colourOf')}>
				{#each targets as tg, i (tg.label)}
					<button
						type="button"
						role="tab"
						aria-selected={tg === target}
						onclick={() => (index = i)}
					>
						<span class="dot" style:background={byCode.get(tg.value)?.hex}></span>
						<span>{tg.label}</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="target-title">
				<span class="label">{target.label}</span>
			</div>
		{/if}

		<div class="current">
			<span class="preview-dot" style:background={current?.hex}></span>
			<span class="name">{current?.name ?? target.value}</span>
			<span class="mono code">#{target.value}</span>
		</div>

		<button type="button" class="more" aria-expanded={all} onclick={() => (all = !all)}>
			<span>{t('allColours')}</span>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
		</button>
	</div>

	{#if all}
		<div class="palette">
			<label class="find">
				<svg viewBox="0 0 20 20" aria-hidden="true"
					><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg
				>
				<span class="sr-only">{t('findColour')}</span>
				<input type="search" placeholder={t('findColour')} bind:value={query} />
			</label>
			<div class="list wrap" role="group" aria-label="{t('colourOf')} {target.label}">
				{#each found as c (c.code)}
					{@render swatch(c)}
				{:else}
					<p class="none">{t('nothing')}</p>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		max-width: 100%;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		min-height: 30px;
		min-width: 0;
		margin: 0;
	}

	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		padding: 2px;
		border-radius: var(--radius-sm);
		background: var(--sunk);
		border: 1px solid var(--line);
	}

	.targets button {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 9px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: var(--ink-2);
		font-size: 0.78rem;
		font-weight: 600;
		transition: all 0.14s ease;
	}

	.targets button:hover {
		color: var(--ink);
	}

	.targets button[aria-selected='true'] {
		background: var(--card-hover);
		color: var(--ink);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.25),
			0 1px 2px rgba(0, 0, 0, 0.4);
	}

	.target-title {
		display: flex;
		align-items: center;
	}

	.current {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		padding: 2px 8px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
	}

	.preview-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
		flex: none;
	}

	.name {
		font-weight: 600;
		font-size: 0.82rem;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 130px;
	}

	.code {
		color: var(--muted);
		font-size: 0.75rem;
	}

	.more {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 13px;
		background: color-mix(in srgb, var(--ink) 3%, transparent);
		color: var(--ink-2);
		font-size: 0.74rem;
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.14s ease;
		flex: none;
	}

	.more:hover {
		border-color: var(--line-focus);
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}

	.more svg {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.15s ease;
	}

	.more[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	.list {
		display: flex;
		gap: 5px;
		align-items: center;
	}

	.palette {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 50;
		width: min(420px, 100%);
		background: var(--card);
		border: 1px solid var(--line-focus);
		border-radius: var(--radius-md);
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75);
		padding: 12px;
		backdrop-filter: blur(20px);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.find {
		position: relative;
		display: flex;
		align-items: center;
	}

	.find svg {
		position: absolute;
		left: 10px;
		width: 14px;
		height: 14px;
		fill: none;
		stroke: var(--muted);
		stroke-width: 2;
		pointer-events: none;
	}

	.find input {
		width: 100%;
		height: 32px;
		padding: 0 12px 0 30px;
		background: var(--sunk);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		color: var(--ink);
		transition: border-color 0.14s;
	}

	.find input:focus {
		border-color: var(--yellow);
		outline: none;
	}

	.wrap {
		flex-wrap: wrap;
		max-height: 220px;
		overflow-y: auto;
		padding: 4px;
		margin: -4px;
		gap: 5px;
	}

	.none {
		margin: 8px 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.swatch {
		position: relative;
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: var(--c);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.35),
			inset 0 -2px 0 rgba(0, 0, 0, 0.25),
			0 1px 3px rgba(0, 0, 0, 0.4);
		transition:
			transform 0.12s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.12s;
		cursor: pointer;
		display: grid;
		place-items: center;
	}

	/* LEGO Stud bevel on the swatch */
	.stud {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.35),
			0 1px 2px rgba(0, 0, 0, 0.3);
		opacity: 0.6;
		pointer-events: none;
	}

	.swatch.metal {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, transparent 60%), var(--c);
	}

	.swatch:hover {
		transform: translateY(-2px) scale(1.08);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.45),
			0 4px 10px rgba(0, 0, 0, 0.5);
		z-index: 2;
	}

	.swatch[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--card),
			0 0 0 4px var(--yellow),
			0 0 14px var(--yellow-glow);
		transform: translateY(-1px) scale(1.06);
		z-index: 3;
	}

	@media (pointer: coarse) {
		.swatch {
			width: 34px;
			height: 34px;
		}
	}

	@media (max-width: 640px) {
		.bar {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}
		.palette {
			position: static;
			width: 100%;
			box-shadow: none;
		}
	}
</style>
