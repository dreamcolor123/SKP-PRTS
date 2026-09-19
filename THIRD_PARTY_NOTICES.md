# License Scope and Third-Party Notices

The root MIT LICENSE applies to original SKP-PRTS code and documentation that
the contributors own or are authorized to license. It does not relicense
third-party code, binaries, fonts, audio, models, artwork or trademarks.
Their original notices and terms remain in force, including where a separate
redistribution license has not been identified. Public availability and a
provenance hash are not substitutes for permission from the rights holder.

## RhineLabUI

- Source: https://github.com/LBEILC/RhineLabUI
- Pinned revision: `17a16118f31b55b7156b68e89b6fe989408351f0`.
- Original code, modeling scripts and technical documentation: MIT,
  Copyright (c) 2026 LBEILC. See [the retained license](ui/rhine/LICENSE).
- The upstream MIT declaration does not separately license GLB/image assets
  or artwork associated with Arknights. No rights to the original game's
  visual designs or trademarks are granted by this project's MIT license.
- The three PV typing samples in `ui/rhine/src/typing-samples.ts` and related
  preview/reference WAV files are excluded from the original synthesized
  music's MIT declaration. See [audio provenance](ui/rhine/public/audio/README.md).
- See [the asset inventory](docs/RHINELAB_ASSETS.md) for further source details.

## Fonts and Branding

- MiSans remains under Xiaomi's [font agreement](ui/rhine/public/fonts/MiSans-license.pdf)
  and [copyright notice](ui/rhine/public/fonts/NOTICE.txt), not MIT.
  Distribution with a work is subject to that agreement. Do not treat font
  files or generated native subsets as an independently sublicensable font
  package. Subsetting/conversion does not establish additional license rights.
- Novecento source fonts/webfont kits are not included. Fixed lettering graphics
  retain [their notice](ui/rhine/public/assets/boot-lettering-notice.txt).
- The SKRoot Pro logo supplied by this project's owner retains its
  [source and animation notice](ui/rhine/public/branding/NOTICE.txt).

## SKRoot and Native Components

- Source: https://github.com/abcz316/SKRoot-linuxKernelRoot
- Pinned revision: `b770cf3bdfe6e2935283dedfcf5d64d931a7fb4d`.
- The upstream manager code, `libkernel_module_kit_static.a`, `libresetprop.so`
  and `libcve2026_43499_ghostlock.so` are not relicensed by this project's MIT.
  No repository-wide MIT grant was identified for these upstream components.
  Their provenance and SHA-256 values are recorded in
  [SOURCE_PROVENANCE.md](SOURCE_PROVENANCE.md); that document is not a license.
  Confirm applicable permissions with upstream before further redistribution
  or uses that are not already authorized by the rights holders.
- `libpermissionmanager.so` and `libmagica.so` are built from the retained
  manager sources, not extracted from an APK. This does not change their
  applicable upstream license terms.

## Other Included Code

- Three.js: [MIT notice](ui/rhine/public/licenses/three.txt); the earlier terminal
  view also retains `app/src/main/assets/terminal/vendor/THREE-LICENSE.txt`.
- Rolling Number: [MIT notice](ui/rhine/public/licenses/rolling-number.txt).
- cJSON and Civetweb: original MIT copyright/license headers remain in source.
- AsmJit: [zlib license](testModule/kernel_module_kit/include/third_party/asmjit2/LICENSE.md).
- AOSP `android_filesystem_config.h`: retained Apache-2.0 source notice.
- `lsplt/syscall.hpp`: retained Google BSD three-clause source notice.
- Android, Kotlin, Compose, npm and other build dependencies retain their own
  licenses. Dependency declarations or bundling do not replace those licenses.

This is an independent UI adaptation, not an official release of RhineLabUI,
Arknights or its rights holders. No endorsement or additional intellectual
property rights are implied.
