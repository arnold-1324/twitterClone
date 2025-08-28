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
					{
						urlPattern: ({ url }) => url.pathname.startsWith('/socket.io'),
						handler: 'NetworkOnly'
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
				target: "http://localhost:5000",
				changeOrigin: true,
				secure: false,
			},
			"/socket.io": {
				target: "https://twitterclone-backend-681i.onrender.com",
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
	},
});
