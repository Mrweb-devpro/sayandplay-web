import {defineConfig} from "@playwright/test";
// Port 3157, so the original Next.js version can keep running on 3156 at the same time.
export default defineConfig({testDir:"./tests",testMatch:"*.spec.ts",workers:1,
 use:{baseURL:"http://127.0.0.1:3157",channel:process.env.BROWSER_CHANNEL||"chrome",serviceWorkers:"block"},
 webServer:{command:"npm run start",url:"http://127.0.0.1:3157",reuseExistingServer:true}});
