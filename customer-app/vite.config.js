import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    resolve: {
        // Prefer TS/TSX sources over emitted .js files in dev/build.
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
    },
    preview: {
        host: '0.0.0.0',
        port: 4173,
    },
});
