import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	build: {
		outDir: 'dist',
	},
	plugins: [
		react(),
		VitePWA({
			registerType: 'prompt',
			devOptions: {
				enabled: true,
				type: 'module'
			},
			includeAssets: ['favicon.png', 'dark-logo-192.png', 'dark-logo-512.png'],
			manifest: {
				name: 'Twitter Clone - React PWA',
				short_name: 'TwitterClone',
				description: 'A Twitter clone built with React',
				theme_color: '#1DA1F2',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '.',
				start_url: './index.html',
				icons: [
					{
						src: 'dark-logo-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'dark-logo-512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			},
			strategies: 'generateSW',
			injectRegister: 'auto',
			workbox: {
				cleanupOutdatedCaches: true,
				sourcemap: true,
				globPatterns: [
					'**/*.{js,css,html}',
					'**/*.{png,jpg,jpeg,svg,gif}',
					'**/*.{woff,woff2,ttf,eot}'
				],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit
				runtimeCaching: [
					{
						urlPattern: ({ url }) =>
							url.origin === 'https://twitterclone-backend-681i.onrender.com' &&
							url.pathname.startsWith('/api'),
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 5,
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 24 * 60 * 60
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					},
					// Handle Socket.IO requests with better error handling
					{
						urlPattern: ({ url }) => 
							url.pathname.startsWith('/socket.io') || 
							url.pathname.includes('socket.io'),
						handler: 'NetworkOnly'
							// Note: Removed networkTimeoutSeconds and plugins as NetworkOnly doesn't support them
							// Socket.IO connections should bypass service worker caching entirely
					},
					{
						urlPattern: /\.(png|jpg|jpeg|svg|gif)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images',
							expiration: {
								maxEntries: 60,
								maxAgeSeconds: 30 * 24 * 60 * 60
							}
						}
					}
				]
			}

		})
	],
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "https://twitterclone-backend-681i.onrender.com",
				changeOrigin: true,
				secure: true,
				configure: (proxy) => {
					proxy.on('error', (err, req, res) => {
						console.log('API proxy error:', err);
					});
					proxy.on('proxyReq', (proxyReq, req) => {
						console.log('Sending API Request to:', proxyReq.path);
					});
				}
			},
			"/socket.io": {
				target: "https://twitterclone-backend-681i.onrender.com",
				changeOrigin: true,
				secure: true,
				ws: true,
				// Additional WebSocket proxy options
				xfwd: true,
				toProxy: true,
				configure: (proxy) => {
					proxy.on('error', (err, req, res) => {
						console.log('Socket.IO proxy error:', err);
						// Don't crash on proxy errors
						if (res && !res.headersSent) {
							res.writeHead(500, {
								'Content-Type': 'text/plain'
							});
							res.end('Socket.IO proxy error');
						}
					});
					proxy.on('proxyReq', (proxyReq, req) => {
						console.log('Sending Socket.IO Request to:', proxyReq.path);
					});
					proxy.on('proxyReqWs', (proxyReq, req, socket) => {
						console.log('WebSocket connection established');
					});
				}
			},
		},
	},
});
