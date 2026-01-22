import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: "server", // Enable SSR for Vercel
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  server: {
    port: 4321,
  },
  vite: {
    define: {
      "import.meta.env.PUBLIC_API_URL": JSON.stringify(
        process.env.PUBLIC_API_URL || "https://website-spk-backend.vercel.app",
      ),
    },
  },
});
