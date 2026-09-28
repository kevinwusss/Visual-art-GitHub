# Visual art — an editorial wardrobe and styling prototype

An independent full-stack project exploring how a personal wardrobe, contextual weather and fashion editorial content can support everyday outfit decisions. Built as a bilingual Chinese/English web application. The project combines a rules-based styling engine with optional external AI and search services; the core experience works without API keys.

> **Project status:** working portfolio prototype. User accounts, shared storage and production-grade multi-user hosting are outside its present scope.

## What you can try

1. Browse the editorial homepage and runway/news content.
2. Add garments to one or more wardrobes, then filter, edit, move and track them.
3. Take the five-question style quiz and view a style profile derived from your inputs and wardrobe.
4. Ask the stylist for an outfit based on a prompt, your selected wardrobe and weather. Without a DeepSeek key, a local scoring engine produces the result.
5. Save outfits, record wears and inspect wardrobe statistics, including cost per wear where purchase prices are available.
6. Browse product recommendations and editorial content. Live search is optional and source modes are labelled in the UI.

## Technical design

| Layer | Implementation |
| --- | --- |
| Interface | Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion |
| State | Zustand persistence in browser `localStorage` |
| Local intelligence | Wardrobe insights, preference rules and outfit ranking in `lib/` |
| Server | Next.js Route Handlers for styling, search, weather, uploads and image proxying |
| Optional services | DeepSeek for AI enhancement, Bocha for live search, Open-Meteo for weather |
| Editorial/product data | Local JSON snapshots and attributed third-party links |

The local stylist selects garments based on the user's prompt, wardrobe and context. The service layer uses external AI when configured, while fallback modes are shown to the user. Photos uploaded by a user are saved to `data/uploads/` on the local server; wardrobe records stay in that browser. This setup is suitable for a local demonstration but does **not** synchronise data between devices. See [architecture and limitations](docs/ARCHITECTURE.md).

## Run locally

Use Node.js 24 and npm. In PowerShell:

```powershell
cd 'C:\Users\17843\Desktop\学习\Visual-art-GitHub'
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. The `.env.local` copy is optional; leave its API keys empty for the local version. To enable external services, add your own keys there and restart the server. Never commit that file. On Windows, `启动.cmd`, `重启.cmd` and `停止.cmd` offer a local launcher. These scripts are not needed by the GitHub build.

Run the project checks before publishing:

```powershell
npm run check:publish
npm run lint
npm run typecheck
npm test
npm run build
```

## Why I built it

This project gave me a practical way to connect user research, visual design, data modelling and software engineering. It required translating a subjective problem—"what should I wear?"—into editable data, explainable recommendations, and honest fallback behaviour when remote services are unavailable. For a master's application, it demonstrates an end-to-end product prototype and the engineering decisions behind it. The [portfolio notes](docs/PORTFOLIO.md) provide a concise description and talking points; adjust the first-person wording to your actual contribution before using it in an application.

## Boundaries and attribution

- API keys are optional; external AI/search requests need your own accounts and may incur charges.
- Fashion photos, article links and product references belong to their publishers or retailers. [Image sources](public/images/editorial/SOURCES.md) are listed separately. Review rights before public or commercial use of any bundled third-party imagery or scraped snapshot.
- Catalog prices are historical snapshot data, not current offers. Approximate converted prices must not be treated as live exchange rates.
- GitHub hosts the source repository. This application uses server routes and filesystem uploads, so GitHub Pages alone cannot run the full app. A deployment would need a Node-compatible host and a persistent storage redesign for uploaded files.
- No license is granted for reuse of this project's original code at present; contact the author if you want to reuse it.

**中文上传教程：** [docs/GITHUB-UPLOAD.zh-CN.md](docs/GITHUB-UPLOAD.zh-CN.md). **Earlier detailed notes:** [docs/LEGACY-NOTES.zh-CN.md](docs/LEGACY-NOTES.zh-CN.md).
