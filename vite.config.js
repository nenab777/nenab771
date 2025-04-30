export default {
    base: '/nenab771/',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: './index.html',
                mcq: './mcq.html'
            }
        }
    },
    server: {
        headers: {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin'
        }
    }
};
