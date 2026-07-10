# WiFi QR Code Generator

A cute, fully client-side WiFi QR code generator. Enter your network name and password, optionally add a logo, pick a color, and download a scannable QR code with rounded dots, a rounded frame, and a transparent or white background.

No backend, no build step, no external data ever leaves the browser — everything runs in plain HTML/CSS/JS.

## Features

- Encodes WiFi credentials as a standard `WIFI:T:WPA;...` QR code (falls back to an open-network code if no password is set)
- Upload a PNG or SVG logo to place in the center of the QR code
- If no logo is uploaded, shows a "Connect to Wifi" label in the center instead
- Cute styling: rounded dots, rounded corner squares, and a rounded frame/border matching your chosen color
- Transparent or white background
- Download the result as a PNG

## Local development

This project has no dependencies to install and no build step — it's static HTML/CSS/JS. A devcontainer is provided for a consistent local preview environment.

1. Open this folder in VS Code and reopen in the devcontainer (or open in GitHub Codespaces).
2. The devcontainer automatically starts a static server on port 8080 (via `.devcontainer/post-start.sh`) and forwards it — VS Code should open [http://localhost:8080](http://localhost:8080) for you automatically.
   - If it doesn't start automatically (e.g. you attach to an already-running container), run it manually:
     ```bash
     http-server -p 8080
     ```

You can also just open `index.html` directly in a browser without the devcontainer — it works the same way, since everything is static.

## How it works

- QR rendering and logo embedding is handled by the [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) library, loaded via CDN in [index.html](index.html).
- [app.js](app.js) builds the WiFi payload string, renders the styled QR code to an offscreen canvas, then composites it with a rounded frame onto the visible preview canvas — the same canvas is used for the PNG download.
- No environment variables or API keys are required.

## Deploying to GitHub Pages

A workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) deploys the site automatically on every push to `main`.

One-time setup (cannot be automated from code):

1. Push this repository to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab) — your site will be published at `https://<username>.github.io/<repo>/`.

## Notes on logos

For best results with SVG logos, make sure the SVG has explicit `width`/`height` (or `viewBox`) attributes — some browsers render SVGs without these at an unexpected default size.

### Auto-loading a logo from the URL

Visiting the site at a path like `/rentwin` automatically pre-selects a matching logo from the `logos/` folder — it looks for `logos/rentwin.svg` and then `logos/rentwin-logo.svg`. This works both with GitHub Pages and with the local `http-server` because [404.html](404.html) stashes the requested path and redirects to the app, which then reads it back and loads the file into the logo input.

To add a new auto-loadable logo, drop an SVG into `logos/` named `<name>.svg` or `<name>-logo.svg`, then share a link to `https://<username>.github.io/<repo>/<name>`.
