# Chargezio scroll site

Scroll-driven 3D site: a car gets plugged in, charges, then drives away.

## Run
    npm install
    npm run dev          # local dev
    npm run build        # production build in dist/
    npm run build:single # one-file preview in dist-single/index.html

## Stack
React, TypeScript, Vite, three.js with react-three-fiber, GSAP ScrollTrigger, Lenis.

## Scene layout
The 3D scene lives in src/scene (Car, Charger, Road) and is composed in src/World.tsx. Timeline and
shared positions are in src/layout.ts.

## Car model
The car is the Mahindra BE 6 style EV built in Blender: `public/models/be6.glb` (about 145K triangles, 0.64 MB,
Draco compressed; the decoder is served from `public/draco/`, WebAssembly only). It is loaded in `src/scene/Car.tsx` with the small
loader in `src/scene/gltf.ts` (the site does not use `@react-three/drei`).
Node names the code relies on: `Wheel_{FL,FR,RL,RR}_Steer` (pivot, front pair steers), `Wheel_xx_Spin` (spins about the
axle), `Caliper_xx`, `Charge_Flap` (origin on its front hinge edge, opens about Y) and `BE6_Body` (everything else, one
primitive per material). Lamps are driven by material name (`BE6_DRL_LED`, `BE6R_Tail_LED` ...) in `Car.tsx`.
The paint (`Body_Paint`) is a matte shader gradient in the logo's colours, green #05CB3F at the front fading to blue #0282EA at
the back; it is fixed to the car, not the world (`uBlue` / `uGreen` in `Car.tsx`).
The charge port position and normal are the `PORT` constants in `src/layout.ts`; camera keys near the port are in `src/camera.ts`.

## Opening shot
The shot is dreamy on purpose: it opens in a soft lilac haze and soft focus with a few slow bokeh lights, the camera drifts, rocks
and breathes a little, and all of it clears as the camera settles (`--dream` is written from `World.tsx`, the veil is `.dream` in
`styles.css`, the float is in `applyIntro`).
After the loading screen the camera starts as a bird's-eye view of the city, drops quickly onto the hero car and starts a full
360 degree orbit around it, while the car drives in (12 s in all, `INTRO_SECONDS` in `src/story.ts`): down cross road A, round
roundabout R1, a right turn onto the main road, along the lane and into the station bay (`src/scene/route.ts`). The camera keeps
the car as the focus, circling clockwise as seen from above and tightening from about 24 m to 12 m, and the orbit ends the moment
the car stops (`INTRO_DRIVE_END`, 0.9 of the shot). The camera then comes down and settles into the hero shot (`applyIntro` and its
`KEYS3` key poses in `src/camera.ts`; fog and the headline fade-in are timed in `World.tsx`). The camera work is laid out on a fixed
15 "design second" timeline and stretched to `INTRO_SECONDS`, so changing the length keeps every beat in proportion. It flies over
the low-rise early on, and in the last seconds stays low enough that its sight line to the car passes under the station canopy's
fascia. Scrolling is locked until it ends; scrolling, touching or pressing a key fast-forwards it. In dev, `?intro=0.62` freezes
the shot at 62% and `window.__story.introT = 9.6` (seconds) scrubs it live (`window.__info` shows the camera and car positions).

## City
`src/scene/cityLayout.ts` describes the map: the main road, cross roads A (x = -48) and B (x = 70), the avenue (z = 90) and
roundabouts R1 and R2. `City.tsx` builds the roads, pavements, junction ramps and roundabouts, `Road.tsx` the main road and the
towers, `Traffic.tsx` the background cars (they follow the lane routes in `cityLayout.ts` and slow down for the hero car) and
`People.tsx` the pedestrians. The cars and the pedestrians are web-ready models in `public/models/city/` (about 2.6 MB in total, Draco compressed, textures in WebP, made in Blender from
low-poly source models that are not part of this project) and instanced in `fleet.ts`. Street, cars, people and the charger share ink outlines (`src/scene/ink.ts`).

## Pages and flow
Two pages, with a tiny router in `src/router.tsx` (no library): `/` (home) and `/about`. Hosting must serve `index.html` for
`/about` too (an SPA fallback), which `vite dev` and `vite preview` already do.
- Home: the 3D story (unchanged), then "Which side of the plug are you on?" with two cards. "I run charging stations" opens
  the partner path (`src/paths/PartnersPath.tsx`: sample dashboard, benefits, how it works, FAQ and a lead form). "I drive an EV"
  opens the driver path (`src/paths/DriversPath.tsx`: the app screens and the download buttons). Each path has a link to switch
  to the other. The choice is kept in the URL, so `/#partners` and `/#drivers` open straight on that path (the opening shot is
  fast-forwarded first), and so do `#partner-how` and `#partner-form`.
- "Get started" (in the header and on the hero) scrolls to the choice. While the opening shot plays scrolling is locked, so a
  click fast-forwards the shot and then scrolls (`scrollToId` in `src/scroll.ts`).
- About (`src/pages/About.tsx`): company story, values and founders. The names, bios, photos and story are placeholders.
- The logo is the brand logo (`public/logo.svg`: a blue to green ring with a plug around a location pin, "Charge" in black and "zio"
  in green). The 3D scene uses it too: `src/scene/logo.ts` holds its vector paths and draws it into the station sign, the totem,
  the charger screen and the charger label (the sign is pre-squeezed so it is not stretched). The brand colours are in `:root`
  in `src/styles.css`; the logo adds a blue (#0282EA) and a green (#05CB3F) for the mark.
- Shared pieces are in `src/ui.tsx`: the logo (`public/logo.svg`, plus `public/logo-dark.svg` with light lettering for the dark
  theme), the header, the footer and the store buttons. The header is one system: every control (Home and About us links, sound
  and theme toggles, "Get started") is the same height (40 px, 36 px on phones) with the same pill / circle shape and the same
  hover, focus and pressed states, and the current page is marked. "Get started" is the same on every page. The bar is frosted glass
  (a translucent tint with the scene blurred behind it, no gradient fade); the tint gets stronger once page content is under it. Below 560 px the Home link is dropped (the logo
  is home) and below 350 px the nav is hidden (About us stays in the footer). The sound and theme switches work on every page.

## Camera on phones
`src/camera.ts` places the camera from a box of what the story must show. On wide screens it keeps the hand-tuned shot. On
narrow (portrait) screens, while the car is parked (about 0.10 to 0.66 of the story) it frames the whole charger, the whole car
and the canopy sign (`FULL_SCENE`), so nothing important is cropped. The insertion close-up keeps its tight framing on purpose.
The charging card at the bottom takes room on a phone, so the scene sits in the top part of the screen.

## Light and dark mode
A sun/moon button in the header switches theme (saved in localStorage, defaults to the system setting). The page uses CSS
variables (`html[data-theme='dark']` in `src/styles.css`). The 3D scene eases from day to night (`story.night`): dark sky and
fog, moon light, lit building windows, glowing street lamps with light pools and real point lights, canopy strip lights, and
the car's own Blender lamps (DRL, projectors, tail, brake, indicators, emblem, roof lights) switched by material name in
`Car.tsx`, plus two headlamp spotlights and beams on the road while it drives.

## Ambient sound
A speaker button in the header mutes and unmutes all sound (the choice is saved in localStorage). There are no audio files:
everything is synthesised live with the Web Audio API in `src/audioEngine.ts` (noise, oscillators, filters), so there is
nothing to license. It loads on demand as its own small chunk. Layers:
- city rumble and wind: kept low, muffled from the bird's-eye view and opening up as the camera comes down;
- everything else (hero car whine and tyres, passing cars, birds, crickets) is nearly silent from the bird's-eye view and grows
  as the camera comes down to the car (`near` in `update()`);
- birds by day; at night crickets play one short phrase, then pause for 5 to 10 seconds;
- the charger's servo, plug click, hum and start/finish chimes follow the scroll;
- music: an original composed futuristic metal-hop beat at 145 BPM in half-time (nothing sampled, no synth melodies). It builds:
  four bars of just the kick, then hats join (plain 8ths, then busy with open hats and rolls), then the snare and clap, and at
  bar 12 the rest drops in (808 bass plus a futuristic growl bass, a heavy metal rhythm guitar, and the metal
  lead). After that a 16-bar song loops: an A section in A minor (Am G F E twice, a melody that climbs in leaps and hangs on the
  E chord's exotic G#) and a B section (Dm Am F G, Dm Am E E, higher and more rhythmic, peaking on D6). From the second loop
  the melody is doubled an octave up. Futuristic touches: electronic metallic hats (six square waves) mixed with noise hats,
  laser-zap accents on kick and snare, a growl bass (two detuned saws and a square through a resonant low-pass that sweeps
  open on every note and wobbles in eighth notes, then distorted, ducking with the kick), ping-pong echoes, a flanger sweeping across the guitars, and zaps, sweeps and risers
  at every layer change. The melody is the `HOOK` table and the chords are `PROG` in `audioEngine.ts`; when each layer enters
  is `HATS` / `SNARE` / `DROP` in `playStep`. The rhythm guitar follows the melody: palm-muted chugs on the melody's rhythm, open
  power chords on the same pitch as its long notes (harmonising it) and driving eighths in the B section; the growl bass
  patterns are `FB_A` / `FB_B` / `FB_EXTRA`. It plays at 5.5% volume (`MUSIC_VOLUME`).

Browsers block audio until the first click, tap or key press, so the button pulses until then and the first click anywhere
starts the sound. It pauses when the tab is hidden. `src/audio.ts` holds the switch and the autoplay handling.

## Placeholders
Logo, App Store and Play Store links (href="#" in src/App.tsx), the phone screens in the app
section (CSS recreations), and copy.
