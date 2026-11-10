import { defineConfig } from 'vite';

// Relative base ('./') so the built app works at any path:
// GitHub Pages project sites (/<repo>/), a custom domain root,
// and inside the Nimiq Pay WebView regardless of the host URL.
export default defineConfig({
  base: './',
});
