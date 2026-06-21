/**
 * afterSign hook for electron-builder.
 *
 * Notarizes the macOS .app bundle so it passes Gatekeeper on end-user machines.
 *
 * WIRING: add to electron-builder.yml mac section:
 *   afterSign: ./scripts/notarize.js
 *
 * CURRENT STATUS: inactive. Only needed when:
 *   hardenedRuntime: true  (electron-builder.yml mac section)
 *   gatekeeperAssess: true (electron-builder.yml mac section)
 *   identity: "Developer ID Application: ..." (valid Apple certificate)
 *
 * With self-signed certificate (hardenedRuntime: false), notarization
 * is not applicable — this script is kept for future re-enablement.
 *
 * Required env vars (set in CI or locally):
 *   APPLE_ID              – Apple ID email
 *   APPLE_ID_PASSWORD     – App-specific password (NOT your Apple ID password)
 *   APPLE_TEAM_ID         – 10-char team identifier from developer.apple.com
 *
 * Alternatively, use API Key auth (@electron/notarize v2+):
 *   APPLE_API_KEY         – path or content of .p8 private key
 *   APPLE_API_KEY_ID      – 10-char Key ID
 *   APPLE_API_ISSUER      – Issuer UUID from App Store Connect
 *
 * If credentials are missing the script silently skips notarization,
 * so local dev builds still work.
 */
const { notarize } = require('@electron/notarize');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appId = 'com.deskwand.app';
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      '[notarize] Skipping — set APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID to enable.'
    );
    return;
  }

  console.log(`[notarize] Notarizing ${appId} at ${appPath} ...`);

  await notarize({
    appBundleId: appId,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_ID_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('[notarize] Done.');
};
