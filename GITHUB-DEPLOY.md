# GitHub deployment notes

1. Create a GitHub repository and upload the contents of this ZIP to the repository root.
2. In repository Settings → Pages, choose GitHub Actions as the build/deployment source.
3. Push to the `main` branch (or run the workflow manually from Actions).
4. The static frontend is deployed by `.github/workflows/pages.yml`.
5. The optional API in `api/worker.js` is a Cloudflare Worker and must be deployed/configured separately; GitHub Pages does not run server-side Worker code. Set the frontend API URL as documented in README.md.

Never commit real API keys, secrets, or `.dev.vars` files.
