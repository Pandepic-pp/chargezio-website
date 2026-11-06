# Chargezio 3D scroll website: handoff for Claude Code

Paste this whole file into Claude Code (or keep it in the repo root as HANDOFF.md) and tell it to read it first.

## 1. Who and what
- Owner: Pratyaksh Pandey, backend-focused SDE (Node, TypeScript, React, PostgreSQL, AWS), founder of ArchWyse.
- Project: marketing website for **Chargezio**, an EV charging app (find chargers, wallet and payments, trips, trip planner).
- Goal: a 3D, scroll-driven site that looks like a premium ("50k $") agency site, is smooth with no lag, and is responsive on every screen size.
- Core idea: scroll tells the story of a car getting plugged in with an EV connector, charging, then driving away.
- Writing preferences for this user: never use em dashes, keep language simple and plain, keep copy short. Apply this to all website copy and comments.

## 2. Decisions the user made
- Car model: placeholder for now (built in code). A real model will be swapped in later.
- Theme: light.
- Scenes: 6 (hero, plug in, charge, drive, app section, download).
- Call to action: App Store and Play Store buttons.
- The user said the animation and story look "really amazing". Do not change the story, timeline or look. Only fix problems and replace placeholders.

## 3. Brand colors (from the Figma file "chargezio", fileKey sFp2qXTDuCuebMTOOasjRZ)
- Primary green #05C158
- Button green #009559
- Amount label green #25C96D
- Black #000000, White #FFFFFF
- Secondary gray text #616274
- Borders and dividers #E5E6EA
- Light blue surface #F3F8FE (also the 3D scene background and fog color)
- Light green surface #EEFAF4
- Wallet gradient #028A58, #00A466, #02A96E
- Accents: blue #0184F4 and #016EFD, purple #771DF7, orange #FA7F26, gold #EFC75E
- Font: Inter Variable, self-hosted through @fontsource-variable/inter.
- Figma MCP note: the sandbox could not download images or SVGs from figma.com. The logo and screen exports are still missing.

## 4. Stack and project location
- Project folder: chargezio-site (zip delivered, no node_modules).
- Vite 8, React 19, TypeScript (strict), three 0.187, @react-three/fiber 9, @react-three/drei 10, GSAP with ScrollTrigger, Lenis, vite-plugin-singlefile.
- Scripts: `npm run dev`, `npm run build` (runs `tsc --noEmit` then `vite build`), `npm run build:single` (one-file preview at dist-single/index.html, uses `SINGLE=1`), `npm run preview`.
- Run: `npm install` then `npm run dev`.

## 5. File map
- index.html: viewport, meta, SEO tags, JSON-LD, favicon (inline SVG pin), noscript fallback.
- public/: og-image.jpg (1200x630, cropped from a screenshot), robots.txt, sitemap.xml.
- src/main.tsx: imports the font, lenis css, styles.css, renders App.
- src/story.ts: shared `story` object (progress, smooth, visible, reduced, quality, dirty, advance, onSlow), helpers `clamp`, `lerp`, `smooth`, `detectQuality()`, `hasWebGL()`.
- src/scroll.ts: `initScroll(el)`. Sets up Lenis and the GSAP ticker, computes progress, updates captions (`data-cap`, `data-in`, `data-out`), the charging HUD (`data-hud`), top progress bar and scroll hint, runs adaptive DPR, adds `[data-reveal]` reveals.
- src/camera.ts: camera keyframes, responsive fit logic, `carX(p)`, `applyCamera`.
- src/World.tsx: the whole 3D scene (car, wheels, charge port, charger station, connector, cable, road, lights, environment).
- src/Experience.tsx: R3F Canvas (`frameloop="never"`), background and fog, DPR state, driver that calls `story.advance`.
- src/App.tsx: DOM layout (loader, header, 4 story captions, app section, download CTA, footer).
- src/styles.css: all styles, CSS variables for the palette.
- README.md: run steps and notes on swapping the car.

## 5b. Realism rework (latest, supersedes the file map above where they differ)
The 3D scene was rebuilt. `src/World.tsx` is now a thin composer (lights, environment, camera). Everything is still procedural, no model files.
- `src/layout.ts`: shared timeline (`phases(p)`), street constants, `connectorPose`, `carPose` (car path, yaw, steering). The scene and the camera both read it.
- `src/scene/carShape.ts`: the car as profile curves (lofted body and greenhouse, `sideZ`, `portFrame`). Change a curve and every part follows.
- `src/scene/paint.ts`: shader-patched paint and glass. Wheel arch holes, panel gaps, sill trim, brand stripe, head and tail lamps, plates and the charge-port opening are drawn per pixel in object space.
- `src/scene/carParts.ts`, `Car.tsx`: wheels (lathed tyre, 10-spoke alloy, brake disc, green calipers), arch trim, liners, mirrors, handles, interior, port housing, flap cut from the skin.
- `src/scene/chargerParts.ts`, `Charger.tsx`: DC charger (screen shows live state, status strips, RFID, e-stop, vents, holster), CCS2 connector, ground-aware cable with pulses.
- `src/scene/Road.tsx`, `textures.ts`: kerb and raised pavement, worn asphalt, EV bay, lane lines, zebra crossing, covers, cracks, stains, lamps, trees, buildings. All textures are canvas drawn at start-up.
- `src/camera.ts`: each key has a hand-tuned wide shot plus a `box` of what the story must show. Narrow screens aim at the box, wide screens pull back only if the box does not fit. Same breakpoint as the CSS.
- `.scrim` in App.tsx and styles.css: soft page-colour wash behind captions so text stays readable over the scene.
- Tone mapping is Neutral (set in Experience.tsx) so brand colours and white paint stay true.
- Dev only: `?cam=x,y,z,tx,ty,tz,fov` pins the camera, `?q=low` forces the low tier, `window.__info` has draw calls and triangles.
- Budget now: 68 draw calls, about 100K triangles (high), 74K (low).
- Still placeholders: a real GLB car would look better than any procedural car. The port and connector are drawn about 1.5x real size on purpose. Plates read "KA 03 EV 2026".

## 6. Architecture (important to keep)
- One GSAP ticker drives everything: `lenis.raf(time*1000)`, `gsap.ticker.lagSmoothing(0)`, progress calculation, DOM updates, then R3F `advance()`.
- The Canvas uses `frameloop="never"`. We render only when needed (animated phases or scroll change) and pause rendering when the story is off-screen.
- DOM captions and the HUD are updated directly, not through React state. Do not move this into React state, it will cause lag.
- Adaptive DPR: if rendered frames average above 26 ms for 90 frames, `story.onSlow` lowers DPR by 0.5, minimum 1. DPR cap is 2.
- Quality tiers come from hardwareConcurrency and deviceMemory. The body uses a physical clearcoat material on high quality, a standard material on low.
- Reduced motion: Lenis and damping are disabled.
- No WebGL: a static fallback div is shown.
- Experience is loaded with `React.lazy`, so text appears first. Loader has a 3.5 s safety timeout.
- Environment lighting is procedural (drei Lightformers), no network HDRI.
- Ground is unlit, `toneMapped=false`, fog color equals the background so it blends.

## 7. Story timeline (progress 0 to 1 over the sticky section, height `calc(100svh*7)`)
- 0.00 to 0.14: hero, car idles, headline "Charge anywhere. Drive everywhere."
- 0.03 to 0.13: charger rises out of the road.
- 0.12 to 0.20: charge port flap opens.
- 0.14 to 0.28: connector approaches. 0.30 to 0.36: insert. Caption "01 Plug in".
- 0.36 to 0.60: charging. Caption "02 Charge" with HUD (24% to 65%, 18.5 kWh, 48 min, 166.75 rupees, peak 76 kW). HUD uses `smooth(0.38,0.58)`. Cable stripes glow and scroll.
- 0.60 to 0.68: unplug, connector returns to the holster.
- 0.68 to 0.98: car drives away, `carX = 30*d^1.7`. Caption "03 Drive".
- After the story: app section (Wallet, Trips, Trip Planner phone mockups, built in CSS from Figma strings) and download CTA with the wallet gradient, then footer.

## 8. Key 3D constants (World.tsx)
- PORT (-2.0, 0.74, 0.93), APPROACH (-2.0, 0.76, 1.6), HOLSTER (-3.0, 1.0, 2.05), STATION_OUT (-3.25, 1.15, 1.9), CABLE_ANCHOR (0, 0.42, 1.5).
- Station group is at x=-3.5, z=1.9, about 0.8 wide and 1.7 tall.
- Car is centered at x=0, about 4.4 long. The charge port is at the rear, left side of the screen in the side view.
- Cable is a custom tube geometry rewritten each frame (cubic Bezier, sag `0.35 + 0.1*dist`).
- Wheels spin with `-cx/0.4`. Only the 2 near-side wheels are modeled.

## 9. Camera and responsive logic (src/camera.ts)
- Keyframes interpolated with smoothstep. Tall screens get a pull-back `m = clamp(1.25/aspect, 1, 2.4)`.
- FOV is `34 + 12*clamp((1.1-aspect)/0.5) + 6*smooth(0.7,1,p)`. Portrait screens get a wider lens, the drive phase widens a bit more.
- **Fit logic (new, fixes the user's bug):** between progress 0.10 and 0.66 the camera is pulled back if needed so the whole station, cable and port fit. Required width is `2*max(|T.x+3.95|, |T.x+1.2|)+0.5`, usable width is `aspect*0.7` on desktop and `aspect*0.96` on portrait, minimum height 2.7.
- Layout shift: desktop (aspect >= 1.1) shifts the scene right with `translateX(-0.12*visH*aspect)` and up `translateY(0.07*visH)` so text on the left stays clear. Portrait shifts the scene up with `translateY(-0.18*visH)` so text at the bottom stays clear.
- Captions: top-left on desktop, bottom on mobile, switched with `@media (max-width: 760px), (max-aspect-ratio: 11/10)`.

## 10. Bug the user reported and what was done
- Problem: at 1904x909 desktop, the station was huge and the car was cropped. On phone (375x667) and tablet (iPad Pro 1032x1376), the charging station was out of frame in the plug-in and charge scenes.
- Fix: the fit logic above. Verified with screenshots at 1904x909, 1440x900, 1032x1376, 768x1024, 375x667 at progress 0.3, 0.4, 0.5. The station and cable are now visible on all of them.
- Side effect: the plug-in close-up is a bit further back than before, and the scene is smaller on phones.
- Not re-checked at the new sizes: the drive-away phase (0.68 to 0.98), the hero (0 to 0.14), the app section and the CTA. Please test these at all sizes, plus landscape phone (for example 844x390) and very wide screens (2560x1080).

## 11. SEO and marketing (done so far)
- Title, description, canonical, robots meta, Open Graph, Twitter card, JSON-LD (Organization and MobileApplication), robots.txt, sitemap.xml, noscript fallback with an h1, one h1 and h2 per section.
- The domain `https://www.chargezio.com/` is a **placeholder** in index.html, public/robots.txt and public/sitemap.xml. Replace it with the real domain.
- The og-image.jpg is a screenshot crop. Replace it with a designed 1200x630 image.

## 12. Still to do (priority order)
1. Replace the real domain everywhere (see section 11).
2. Real App Store and Play Store links (currently `href="#"` in `StoreButtons` in App.tsx). Add UTM parameters.
3. Real logo as SVG (the current Logo component is a placeholder pin icon). Also favicon and apple-touch-icon.
4. Real car and connector 3D model (GLB). Needs separate named parts: body, wheels, port flap, glass. Keep under about 50K polygons, compress with gltfpack or Draco, use 1K textures for mobile. Use drei `useGLTF`. Place the charge port at the PORT constant. Tune the camera keyframes and constants after the swap.
5. Replace CSS phone mockups with real Figma screen exports (PNG or WebP) if the user wants exact screens.
6. Pre-render the HTML (for example with a build step that snapshots the page, or move to a framework with static output) so crawlers and link bots see the text. Right now it is client-rendered only.
7. Analytics (GA4, Meta Pixel), cookie consent if needed, and event tracking on store-button clicks.
8. Real-device performance test (Lighthouse, Chrome DevTools performance, a mid-range Android phone, an older iPhone). All testing so far used software GL (swiftshader), so real FPS is unknown. Budgets: under about 100 draw calls and 100K vertices on mobile, DPR cap 2.
9. Accessibility pass: keyboard focus, contrast, reduced-motion check, alt text, aria labels on the phone mockups.
10. Final copy review (no em dashes, simple words).
11. More pages for SEO later (city pages, blog, FAQ, privacy policy, terms).
12. Cross-browser check: Safari (iOS and macOS), Firefox, Chrome, Edge. Check Lenis smooth scroll on iOS and that the address bar resize does not jump the scene (the story uses `svh`).

## 13. Known limits and things not to break
- The car is a simple extruded shape, and only 2 wheels are modeled. This is a placeholder.
- Do not add heavy assets or a network HDRI. Keep the first load light.
- Do not move scroll or animation updates into React state.
- Keep fog color equal to the background (#F3F8FE) or the ground edge will show.
- `chunkSizeWarningLimit` is raised to 1600 because the three.js chunk is large (about 994 kB, 268 kB gzipped). Consider splitting or trimming drei imports if load time matters.

## 14. How this was tested
- Headless Chrome with puppeteer-core and swiftshader, using a script that scrolls to a given progress and screenshots (`node shoot.mjs <label> <w> <h> <progress...>`). It lives outside the project. Recreate it if needed: load the preview, wait 4.5 s, scroll to `top + progress*(storyHeight - viewportHeight)`, wait 1.8 s, screenshot.
- Console showed no errors in the latest runs.

## 15. Suggested first prompt for Claude Code
"Read HANDOFF.md. Run npm install and npm run dev. Then test every scene at phone, tablet and desktop sizes, including landscape phone and ultrawide, and fix any framing or text overlap problems without changing the story or look. Then work through section 12 in order. Keep copy simple and never use em dashes."
