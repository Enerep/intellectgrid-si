# IntellectGrid.si

A cinematic domain-for-sale landing page with a custom animated 3D intelligence network. Written entirely in HTML, CSS, and JavaScript. No npm packages, installation, build step, external fonts, analytics, or CDN scripts.

## Local preview

Run `python3 preview.py`, then open http://127.0.0.1:4311. Python is needed only for local preview. `preview.py` serves the `public` directory and applies the same security headers as Vercel.

## Deploy to Vercel

1. Push this folder to its own Git repository and import that repository into Vercel.
2. Select **Other** as the framework preset. The included `vercel.json` sets an empty build command, an empty install command, and `public` as the output directory.
3. Deploy, then add `intellectgrid.si` in the project's domain settings and apply the DNS records Vercel provides at your registrar. Vercel will show the records appropriate to your domain setup.
4. Verify the deployed inquiry flow with your preferred email client.

Vercel documentation: [static project configuration](https://vercel.com/docs/project-configuration/vercel-json), [static builds](https://vercel.com/docs/builds), and [adding a domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

The project deploys only files in `public`. Local tools, configuration files, and this README are not public site assets. Hosting and DNS have not been configured by this repository.

## Contact and content

The public contact address is `batcontact.help@gmail.com`, configured in `public/config.js`. It is intentionally visible to visitors. This static site cannot read Vercel environment variables at runtime, so edit this file to change the public email. Never put secrets in it.

The acquisition modal prepares an email draft addressed to the owner. Visitors send it using their own email app, or use the Gmail / copy-inquiry fallback. The site does not send emails, save inquiries, charge visitors, or complete a domain transfer. If clipboard access is unavailable, the copy button downloads the inquiry as a text file.

Copy and SEO metadata live in `public/index.html`. Colors and responsive layouts live in `public/styles.css`. The native Canvas 3D renderer is in `public/scene.js`. There is no fixed asking price; the offer field is optional.

## Motion and accessibility

The animation pauses when it is offscreen or the tab is hidden. It is capped at 30 frames per second, respects `prefers-reduced-motion`, and has a visible pause/play control. The page includes semantic landmarks, keyboard focus styles, a skip link, labeled form fields, and a native focus-trapping dialog. All main content remains readable without JavaScript, with a direct email link in the footer.
