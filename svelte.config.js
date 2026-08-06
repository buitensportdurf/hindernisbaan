import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const basePath = process.env.BASE_PATH ?? '';

if (basePath && !basePath.startsWith('/')) {
  throw new Error(`BASE_PATH must start with "/". Received: ${basePath}`);
}

export default {
  preprocess: vitePreprocess(),
  kit: {
    paths: {
      base: basePath
    },
    adapter: adapter({ fallback: 'index.html' }),
    alias: { $lib: 'src/lib' }
  }
};
