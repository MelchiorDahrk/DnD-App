import type { PortraitTheme } from './lighting.ts';

export const appearance = $state({ theme: 'light' as PortraitTheme });

export function applyAppearance(theme: unknown) {
	if (theme !== 'light' && theme !== 'dark') return;
	appearance.theme = theme;
	document.documentElement.dataset.theme = theme;
}
