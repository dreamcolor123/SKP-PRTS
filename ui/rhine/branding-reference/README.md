# User Logo Source

`skroot-pro-preview.html` is an unchanged copy of the project owner's supplied
logo and motion preview from 2026-09-19.

Original path:
`C:/Users/Administrator/Documents/Codex/2026-09-19/new-chat/outputs/skroot-pro-preview.html`

SHA-256:
`d9ab89839112c72f3626d81ea79bb47e29a6666a7f88604a797358e30f4deaee`

The four paths, purple gradient, cubic easing, 1.3-second assembly and
4.2-second highlight cycle are transcribed in `src/user-logo.ts`. The source
preview is not packaged in the app and its controls are not application UI.
Existing wordmark and surrounding RhineLabUI animation retain their provenance.

Regenerate checked-in exports from `ui/rhine`:

```text
node scripts/build-skp-brand.mjs
node scripts/build-native-logo.mjs
node scripts/build-icons.mjs
```

The latter two commands require `sharp`, with `SHARP_MODULE` optionally pointing
to an existing module. Runtime builds use checked-in assets and do not require
sharp or access to the source author's original directory.
