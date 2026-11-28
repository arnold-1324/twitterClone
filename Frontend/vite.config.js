import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import manifest from "./public/manifest.json";

function registerProductionWorker() {
  return {
    name: "social-register-production-worker",
    apply: "build",
    transformIndexHtml: () => [{
      tag: "script",
      attrs: { "data-network-shell": true },
      children: readFileSync(new URL("./public/registerSW.js", import.meta.url), "utf8"),
      injectTo: "head-prepend",
    }],
  };
}

// A production PWA may already control the origin when Vite starts on the
// same host and port. Replace that worker so it cannot serve old build assets.
function retireDevelopmentServiceWorker() {
  return {
    name: "dayline-retire-development-worker",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/sw.js" && path !== "/dev-sw.js") return next();
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(`
          self.addEventListener("install", () => self.skipWaiting());
          self.addEventListener("activate", (event) => {
            event.waitUntil((async () => {
              await self.clients.claim();
              await self.registration.unregister();
              const tabs = await self.clients.matchAll({ type: "window" });
              await Promise.allSettled(tabs.map((tab) => tab.navigate(tab.url)));
            })());
          });
        `);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const target = process.env.DAYLINE_API_TARGET || (mode === "development"
    ? "http://127.0.0.1:5000" : "https://twitterclone-backend-681i.onrender.com");

  return {
    build: { outDir: "dist" },
    plugins: [
      react(),
      retireDevelopmentServiceWorker(),
      registerProductionWorker(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          enabled: false,
          type: "module",
        },
        includeAssets: ["favicon.png", "dark-logo-192.png", "dark-logo-512.png"],
        manifest,
        strategies: "generateSW",
        injectRegister: false,
        workbox: {
          skipWaiting: false,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          sourcemap: true,
          globPatterns: ["index.html", "assets/**/*.{js,css,woff,woff2,ttf,eot}"],
          globIgnores: [
            "assets/pdf-*.js",
            "assets/hls.light-*.js",
            "assets/videoEffects-*.js",
            "assets/vision_wasm*-*.js",
          ],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          navigateFallback: null,
          directoryIndex: null,
          runtimeCaching: [
            {
              urlPattern: ({ sameOrigin, url }) => sameOrigin && /^\/(api|socket\.io)(\/|$)/.test(url.pathname),
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
              handler: "NetworkOnly",
              options: { precacheFallback: { fallbackURL: "/index.html" } },
            },
            {
              urlPattern: ({ url, sameOrigin, request }) => sameOrigin && request.destination === "image"
                && /^\/[^/]+\.(png|jpe?g|jfif|svg|gif|webp|avif|ico)$/i.test(url.pathname),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images",
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 48, maxAgeSeconds: 604800 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on("error", (_error, _request, response) => {
              if (!response?.writeHead || response.headersSent || response.writableEnded) return;
              response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
              response.end(JSON.stringify({ error: "The app is temporarily unavailable. Try again in a moment." }));
            });
          },
        },
        "/socket.io": {
          target,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  };
});
