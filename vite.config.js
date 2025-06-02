import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'html-full-reload',
      handleHotUpdate({ file, server }) {
        if (file.endsWith('.html')) {
          server.ws.send({ type: 'full-reload' });
        }
      },
    },{
      name: 'css-full-reload',
      handleHotUpdate({ file, server }) {
        if (file.endsWith('.css')) {
          server.ws.send({ type: 'full-reload' });
        }
      },
    }
  ],
});