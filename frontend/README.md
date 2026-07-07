# ChainChat Frontend

The React frontend for ChainChat, a decentralized messaging app powered by the
[XMTP Protocol](https://xmtp.org). Built with [Vite](https://vitejs.dev).

See the [root README](../README.md) for a full project overview.

## Scripts

| Command           | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Start the dev server at http://localhost:5173          |
| `npm run build`   | Build for production into `dist/`                      |
| `npm run preview` | Serve the production build locally                     |
| `npm run deploy`  | Manually deploy `dist/` to GitHub Pages via `gh-pages` |

## Requirements

- Node.js 18+
- A browser with MetaMask (or a compatible injected wallet) for actually using the app

## Notes

- The Vite `base` is set to `/ChainChat/` in `vite.config.js` to match the
  GitHub Pages project path. Deployment to Pages happens automatically on
  pushes to `main` via `.github/workflows/deploy.yml`.
- Messaging uses the XMTP V3 browser SDK (`@xmtp/browser-sdk`), which is
  WASM-backed and loaded dynamically so it stays out of the initial bundle.
- Contacts are stored in browser `localStorage`; messages live on the XMTP
  network.
