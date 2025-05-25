import { defineConfig, presetUno, presetWebFonts } from 'unocss';

export default defineConfig({
  content: {
    filesystem: ['src/**/*.{html,js,ts,jsx,tsx,vue,svelte,astro}'],
  },
  presets: [
		presetUno({
			important: true
		}),
		presetWebFonts({
			fonts: {
				roboto: {
					name: 'Roboto',
					provider: 'none',
				},
			},
		}),
	],
});
