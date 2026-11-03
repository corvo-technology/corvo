# Releasing the desktop app by hand

Use this when the `release-desktop` workflow is not available (for example GitHub Actions is off). It follows the same steps as the workflow in `.github/workflows/release-desktop.yml`; read `docs/desktop-release.md` first for the secrets and the tag rules.

Each system is built on that system. The app has native modules and bundles the local database programs for its own platform, so a build for one system cannot be made on another.

## Before you start
1. Bump `version` in `apps/desktop/package.json`, merge to `main`, and check out that commit.
2. Run `pnpm install` on every build machine.
3. Decide where the installers will be published. Auto-update and the one-line install scripts need the release files to be downloadable without signing in.

## macOS (signed and notarized, universal)
Needs a Developer ID Application certificate and an App Store Connect API key (see `docs/desktop-release.md`).

```sh
export CSC_LINK="<base64 of the .p12>"          # or a path to the .p12
export CSC_KEY_PASSWORD="<its password>"
export APPLE_API_KEY_ID="<key id>"
export APPLE_API_ISSUER="<issuer id>"
export APPLE_API_KEY="<path to AuthKey_*.p8>"   # keep this file out of the repository
pnpm --filter @corvo/web build
pnpm --filter @corvo/desktop build
pnpm --filter @corvo/desktop exec electron-builder --mac --universal --publish never -c.forceCodeSigning=true
```

Check the result with `codesign --verify --deep --strict` and `spctl --assess` on the app, and `xcrun stapler validate` on the dmg. Remove the `.p8` file afterwards.

## Windows (x64)
Needs an Authenticode certificate. Without one the installer is unsigned and Windows shows a SmartScreen warning; update signature verification is on in the build, so an unsigned build needs `-c.win.verifyUpdateCodeSignature=false`.

```powershell
$env:WIN_CSC_LINK = "<path to the .pfx>"
$env:WIN_CSC_KEY_PASSWORD = "<its password>"
pnpm --filter @corvo/web build
pnpm --filter @corvo/desktop build
pnpm --filter @corvo/desktop exec electron-builder --win --x64 --publish never -c.forceCodeSigning=true
```

## Linux (x64)
No signing needed.

```sh
pnpm --filter @corvo/web build
pnpm --filter @corvo/desktop build
pnpm --filter @corvo/desktop exec electron-builder --linux --x64 --publish never
```

## Publish
The installers and the update feeds (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`) land in `apps/desktop/out/`. Every feed must say the release version. Gather them in one folder, write a checksum file, and create the release only when every system you ship is present:

```sh
( cd release-files && shasum -a 256 * > SHA256SUMS )
gh release create "v<version>" release-files/* --draft --generate-notes --title "Rook v<version>" --verify-tag
gh release edit "v<version>" --draft=false --latest
```

A release with only some systems breaks auto-update for the missing ones, so publish all or none.

## After publishing
Install each build on a clean machine of its system, open it, and check that the local engine starts and the app opens without a sign-in screen.
