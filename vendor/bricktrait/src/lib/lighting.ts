export type PortraitTheme = 'light' | 'dark';

/** Warm parchment daylight and brass candlelight. */
export const LIGHTING = {
	light: { key: 0xfff0d8, keyPower: 3.1, fill: 0xdce8df, fillPower: 1.25, rim: 0xe4c48c, rimPower: 2.1, sky: 0xf8efdc, ground: 0x536b55, ambient: 0.7, environment: 0.55, exposure: 1.05, emission: 0.85 },
	dark: { key: 0xffd9a3, keyPower: 3.4, fill: 0xc4d7ce, fillPower: 0.85, rim: 0xe4c48c, rimPower: 2.8, sky: 0xd4dcc5, ground: 0x24362b, ambient: 0.48, environment: 0.4, exposure: 1, emission: 1.15 }
} as const;

export type LightingTheme = keyof typeof LIGHTING;
