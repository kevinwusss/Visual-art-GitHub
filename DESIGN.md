# Visual art — interface system

The existing identity is an editorial personal styling workspace: warm paper, ink, quiet olive accents, fine rules and real fashion photography. Chinese is the primary interface language; English and dark mode remain supported.

## Homepage

The experience leads with portrait runway photography and a clearly visible styling action. The cover pairs a monochrome KHAITE portrait with a smaller color Ralph Lauren photograph. Source captions remain adjacent to photographs. Editorial titles are subordinate to the photographs; controls never require a hover to discover.

Use Cormorant for the Latin masthead and signature details, the existing serif stack for Chinese editorial headings, and the existing platform UI stack for product controls. Body copy stays at 13–14px minimum in the cover, with generous leading. Keep the home cover at two columns above 640px and stack it below that width.

## Shared product surfaces

Colors live in the semantic tokens in app/globals.css. All interactive navigation controls have generous touch targets, current-page semantics, visible keyboard focus, and named navigation regions. The mobile menu traps and restores focus and closes at the desktop breakpoint.

Footer links expose styling, wardrobe, style quiz and profile. Explain browser-local storage where relevant. Show unavailable services honestly and keep environment-variable instructions out of the styling flow.

## Motion and imagery

The cover has one short entrance from an already-visible state. List reveals use the shared observer, a maximum 300ms stagger, and transform/opacity only. Honor reduced motion. Do not animate entire routes on top of child reveals.

Local cover assets use responsive WebP variants; remote product images retain their provenance and the common unavailable-image state. Do not replace missing product images with unrelated fashion photographs.

## Verification

Run npm run lint, npm run typecheck, npm test and npm run build. Test the homepage at desktop and phone widths, navigation by keyboard, theme/language switches, and the styling/wardrobe/discovery/profile paths. Image-host tests require Node 22.18+ or Node 24 for native TypeScript stripping.
