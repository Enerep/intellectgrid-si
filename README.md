# IntellectGrid.si

An interactive sculpture exhibition for intellectgrid.si. Warm paper, oversized type, and a native WebGL sculpture woven from charcoal-metal ribbons. The domain is available through a small inquiry dialog.

## Preview

Run `python3 preview.py`, then open http://127.0.0.1:4311. No installation or build step is needed. The preview serves only `public/` and applies the production security headers from `vercel.json`.

## The experiment

- Three smoothly morphing forms: Entangle, Orbit, and Lattice.
- Drag to rotate. Hold the sculpture to unravel it. The disorder slider holds the ribbons apart; Break the pattern triggers a burst.
- Keyboard: 1 / 2 / 3 change form, arrows turn it, Space breaks the pattern, R resets, and P pauses. The canvas is focusable; shortcuts leave editable fields and native button activation alone.
- Optional sound plays quiet synthesized notes on deliberate interactions. Sound starts off.
- Pausing freezes the current sculpture; direct controls still work. Reduced-motion starts paused and changes shape immediately. Hidden/offscreen scenes stop rendering. WebGL context loss is recoverable, and unsupported browsers get a Canvas 2D fallback.
- On smaller screens, the scene uses fewer ribbons and vertices. Pixel density is capped. All assets, including licensed fonts, are served locally.

`public/scene.js` owns geometry, shading, and interaction physics. `public/site.js` connects controls, optional audio, and dialogs. `public/styles.css` owns the responsive exhibition layout. Fonts and their SIL Open Font Licenses are in `public/fonts/`.

## Inquiries

The public owner email is `batcontact.help@gmail.com`, configured in `public/config.js`. The form prepares an email draft locally and offers email app, Gmail, and copy options. Clipboard failure downloads a text file. No inquiry is sent or stored by the site, and no payment or transfer occurs here.

## Deployment

The existing `vercel.json` deploys `public/` as a static site, with no build or installation command. Push/deployment is intentionally separate from local editing. No external fonts, scripts, analytics, or runtime dependencies are used.
