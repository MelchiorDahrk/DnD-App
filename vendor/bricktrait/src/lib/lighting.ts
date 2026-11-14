export type PortraitTheme = 'light' | 'dark';

/** A focused key with restrained fill keeps the LDraw palette saturated. */
export const LIGHTING = {
	light: { key: 0xfff4e4, keyPower: 3, fill: 0xe3eaf6, fillPower: 0.24, rim: 0xb8cced, rimPower: 0.65, sky: 0xe4eaf3, ground: 0x38483a, ambient: 0.22, environment: 0.16, exposure: 1, emission: 1 },
	dark: { key: 0xfff0dc, keyPower: 2.9, fill: 0xc3d8ef, fillPower: 0.16, rim: 0xcfb677, rimPower: 0.85, sky: 0xcbd9df, ground: 0x1d2b23, ambient: 0.16, environment: 0.12, exposure: 1, emission: 1.1 }
} as const;

export type LightingTheme = keyof typeof LIGHTING;
