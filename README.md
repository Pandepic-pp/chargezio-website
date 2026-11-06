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
shared positions are in src/layout.ts. See HANDOFF.md section 5b.

## Swap in a real car model
The car is built in code (src/scene/Car.tsx and carShape.ts). To use a GLB, export it with separate
named parts (body, wheels, port flap, glass), load it with drei's useGLTF, and place the port at
PORT in src/layout.ts. Keep it under about 50K polygons and compress with gltfpack or Draco.

## Placeholders
Logo, App Store and Play Store links (href="#" in src/App.tsx), the phone screens in the app
section (CSS recreations), and copy.
