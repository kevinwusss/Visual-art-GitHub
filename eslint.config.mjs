import {defineConfig,globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
export default defineConfig([
  ...nextVitals,
  // .scrape-venv 是 Scrapling 的 Python 虚拟环境（内含第三方 JS，不参与前端 lint）
  globalIgnores([".next/**","node_modules/**",".scrape-venv/**","data/**","public/**"])
]);
