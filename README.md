# Gravity 3D

A browser-based 3D orbital sandbox. Create textured planets, orbit the camera, explore up close, rename worlds, and destroy planets. Built with JavaScript, Three.js, and Vite. No backend, API keys, or external texture downloads are required at runtime.

## VISIT THE SITE : https://sharmashriya136-alt.github.io/gravity-3d/

## Start in VS Code

1. Install Node.js **22.12 or newer** from https://nodejs.org/ (a supported LTS version is recommended).
2. Unzip this download. In VS Code choose **File → Open Folder → gravity-3d**. The folder you open must contain `package.json`.
3. Open **Terminal → New Terminal** and run:

```sh
npm ci
npm run dev
```

4. Open the localhost URL shown in the terminal. Keep the terminal running. Stop with `Control+C`.

Do not double-click `index.html`: this version uses JavaScript modules and needs the local server. `npm ci` needs internet access to install dependencies the first time. A WebGL 2 capable browser/GPU is required.

## Controls

- **Drag** the scene to orbit the camera. **Scroll/pinch** to zoom. Right-drag to pan in the overview.
- Click a planet, or choose it from **Your worlds**. The inspector appears below the world list; scroll the control panel if needed.
- **Explore close-up** flies to the selected body and follows it while it moves. Drag to inspect every side; scroll to approach the surface. This is an orbital close-up, not a walkable terrain/landing simulation.
- **All worlds** returns to the overview. **Top view** looks down at the same 3D simulation.
- Edit **Planet name** and click **Save**. Names are limited to 32 characters and rendered as text, not HTML.
- Change **Surface** to choose ocean, ice, gold gas, violet gas, silver rock, or copper desert textures.
- **Destroy** asks for confirmation. The central star can be renamed but cannot be destroyed.
- **Add planet** launches a new world on a tilted orbit. Automatic style cycles through all six types. Maximum 24 planets keeps the pairwise simulation manageable.
- **Space** pauses/resumes; **F** explores the selection; **Escape** returns to overview. Shortcuts are ignored while typing or confirming an action.
- **Save universe** stores the current system on this browser. **Load saved** restores it after confirmation. Save again after edits if you want them retained. Storage is tied to the site origin: localhost and a deployed site have separate saves.

## Push the source to GitHub

Git tracks your code; GitHub hosts the repository. GitHub Pages hosts the running website.

Create an **empty GitHub repository** named `gravity-3d` (do not initialize it with another README), then run these commands inside this project folder. Replace `YOUR_USERNAME` before running the remote command:

```sh
git init
git add .
git commit -m "Build Gravity 3D orbital sandbox"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gravity-3d.git
git push -u origin main
```

GitHub may ask you to sign in. Do not put tokens or passwords into project files. `node_modules` and `dist` are intentionally ignored; commit `package-lock.json`.

## Deploy on GitHub Pages

1. In your GitHub repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy Gravity to GitHub Pages → Run workflow**. If an initial push ran before Pages was enabled, rerun it.
4. The workflow installs locked dependencies, runs physics tests, builds, and deploys `dist`. Its deployment step displays the live URL.

The included `base: './'` configuration makes asset URLs work under a repository subpath. The workflow runs on pushes to `main`. Hosting availability depends on your GitHub account and repository visibility. No repository or live site has been created for you by this download.

For another static host: use build command `npm run build` and output folder `dist`. Locally test the production build with:

```sh
npm test
npm run build
npm run preview
```

## Source map

| File | What to edit |
| --- | --- |
| `index.html` | Panel content and controls |
| `src/style.css` | Large fonts, spacing, colors, responsive layout |
| `src/main.js` | Camera, selection, renaming, deletion, saving, scene rendering |
| `src/physics.js` | Forces, fixed-step integration, collisions, presets |
| `src/textures.js` | Procedural surface colors, clouds, craters, gas bands |
| `tests/physics.test.js` | Automated physics and state-validation checks |
| `.github/workflows/deploy.yml` | GitHub Pages build/deployment automation |

## Engineering notes and limitations

- True 3D sphere meshes, perspective camera, raycast selection, and sun-position lighting. Surface maps are procedurally generated artwork, not NASA imagery or measured planetary terrain.
- 3D pairwise gravity with softened distances and a fixed 1/120 simulation-time step using velocity Verlet integration. Bodies merge on contact, conserving mass and linear momentum. Display radii equal collision radii.
- Units and sizes are illustrative, not kilometers, Earth masses, or years. Some very fast or pathological encounters can still challenge discrete collision detection; this is a learning sandbox rather than a precision astronomy tool.
- Texture seeds differ between planets. Geometry is shared, and resources are disposed when a body is removed or restyled. Graphics quality and frame rate depend on your GPU.
- Initial texture generation may take several seconds. If performance is poor, reduce pixel ratio in `src/main.js`, reduce texture resolution in `src/textures.js`, turn off trails, or use fewer planets.
- Save/load is local-only, not a server account or cloud backup. Reset and destroy do not overwrite the last save unless you explicitly save again.

Implementation references: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Vite static deployment](https://vite.dev/guide/static-deploy.html).

## Verification for this delivery

The six automated tests pass and the Vite production build completes. The production dependency audit reported no vulnerabilities at the time of packaging. A real-browser visual/interaction check could not be completed in the build environment because its browser download timed out. Treat camera feel, GPU-specific rendering, and mobile appearance as needing your first local browser check, not as verified across devices.
