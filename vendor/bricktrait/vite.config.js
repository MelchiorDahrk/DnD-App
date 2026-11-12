import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {resolve} from 'node:path';

export default defineConfig({
  root:import.meta.dirname,
  base:'./',
  publicDir:'static',
  plugins:[svelte({compilerOptions:{runes:true}})],
  resolve:{alias:{'#lib':resolve(import.meta.dirname,'src/lib')}},
  build:{outDir:resolve(import.meta.dirname,'../../portrait-maker'),emptyOutDir:true}
});
