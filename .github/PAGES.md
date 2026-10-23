# Hosting on GitHub Pages

The Pages workflow deploys the **client** only. The Convex backend must be
deployed separately.

1. Deploy the backend once:

   ```bash
   bunx convex deploy
   ```

   Copy the deployment URL (`https://<deployment>.convex.cloud`).

2. In the repository, open **Settings → Secrets and variables → Actions →
   Variables** and add:

   | Variable | Value |
   | :-- | :-- |
   | `VITE_CONVEX_URL` | your Convex deployment URL |

3. Open **Settings → Pages** and set **Source** to **GitHub Actions**.

4. Push to `main` (or run **Deploy to GitHub Pages** from the Actions tab).

The site is published at `https://<user>.github.io/<repo>/`. The workflow:

- builds with the correct repository base path,
- copies `index.html` to `404.html` so deep links like `/room/ABCD` boot the
  SPA,
- writes `.nojekyll`,
- publishes the `dist/` folder.

## Custom domain

Set the optional `PAGES_BASE_PATH` Actions variable to `/` so assets resolve
from the domain root.

## Notes

- `VITE_CONVEX_URL` is a build-time value. It is public in the bundle, which is
  why it is stored as a repository variable rather than a secret.
- Backend changes are **not** deployed by this workflow. Run
  `bunx convex deploy` after changing schema or Convex functions, or add a
  separate workflow with `CONVEX_DEPLOY_KEY`.
- `src/convex/_generated/` is committed so CI can typecheck without a
  deployment. Regenerate it with `bunx convex dev` after changing the backend.
