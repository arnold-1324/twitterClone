import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
	build: {
    outDir: 'dist', 
  },
	plugins: [react()],
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "http://localhost:5000", // Adjust the target to your backend server
				changeOrigin: true,
				secure: false,
			},
		},
	},
});

