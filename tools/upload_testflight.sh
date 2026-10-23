#!/usr/bin/env bash
set -euo pipefail
# Credentials enter only through a protected GitHub environment, never arguments
# supplied by a pull request or files committed to this public repository.
for NAME in APPLE_TEAM_ID APPLE_BUNDLE_ID APP_STORE_KEY_ID APP_STORE_ISSUER_ID APP_STORE_PRIVATE_KEY APPLE_DISTRIBUTION_P12_BASE64 APPLE_DISTRIBUTION_P12_PASSWORD APPLE_PROFILE_BASE64; do
  if [[ -z "${!NAME:-}" ]]; then echo "Missing TestFlight configuration: $NAME" >&2; exit 1; fi
done
umask 077
PRIVATE_DIR=$(mktemp -d "${RUNNER_TEMP:-/tmp}/scoreprep-signing.XXXXXX")
KEYCHAIN="$PRIVATE_DIR/signing.keychain-db"
KEYCHAIN_PASSWORD=$(openssl rand -hex 24)
PROFILE_PATH=''
cleanup() {
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  if [[ -n "$PROFILE_PATH" ]]; then rm -f "$PROFILE_PATH"; fi
  rm -rf "$PRIVATE_DIR"
}
trap cleanup EXIT
export PRIVATE_DIR
python3 - <<'PY'
import base64, os
from pathlib import Path
root = Path(os.environ['PRIVATE_DIR'])
(root / 'distribution.p12').write_bytes(base64.b64decode(os.environ['APPLE_DISTRIBUTION_P12_BASE64'], validate=True))
(root / 'profile.mobileprovision').write_bytes(base64.b64decode(os.environ['APPLE_PROFILE_BASE64'], validate=True))
(root / ('AuthKey_' + os.environ['APP_STORE_KEY_ID'] + '.p8')).write_text(os.environ['APP_STORE_PRIVATE_KEY'])
PY
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$PRIVATE_DIR/distribution.p12" -P "$APPLE_DISTRIBUTION_P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" "$HOME/Library/Keychains/login.keychain-db"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null
security cms -D -i "$PRIVATE_DIR/profile.mobileprovision" > "$PRIVATE_DIR/profile.plist"
PROFILE_UUID=$(/usr/libexec/PlistBuddy -c 'Print UUID' "$PRIVATE_DIR/profile.plist")
PROFILE_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
mkdir -p "$(dirname "$PROFILE_PATH")"
cp "$PRIVATE_DIR/profile.mobileprovision" "$PROFILE_PATH"
export PROFILE_UUID
python3 - <<'PY'
import os, plistlib
from pathlib import Path
root = Path(os.environ['PRIVATE_DIR'])
with (root / 'profile.plist').open('rb') as f: profile = plistlib.load(f)
team, bundle = os.environ['APPLE_TEAM_ID'], os.environ['APPLE_BUNDLE_ID']
assert profile['TeamIdentifier'] == [team], 'Profile has the wrong developer team'
assert profile['Entitlements']['application-identifier'] == team + '.' + bundle, 'Profile has the wrong bundle ID'
assert not profile['Entitlements'].get('get-task-allow'), 'Use an App Store distribution profile'
assert 'ProvisionedDevices' not in profile and not profile.get('ProvisionsAllDevices'), 'Use an App Store distribution profile'
options = dict(method='app-store-connect', destination='export', signingStyle='manual',
    teamID=team, signingCertificate='Apple Distribution',
    provisioningProfiles={bundle:os.environ['PROFILE_UUID']}, manageAppVersionAndBuildNumber=False)
with (root / 'ExportOptions.plist').open('wb') as f: plistlib.dump(options, f)
PY
python3 tools/prepare_verovio.py
xcodegen generate --spec project.yml
xcodebuild archive -project ScorePrep.xcodeproj -scheme ScorePrep \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/ScorePrep-signed.xcarchive \
  CURRENT_PROJECT_VERSION="$GITHUB_RUN_NUMBER" \
  PRODUCT_BUNDLE_IDENTIFIER="$APPLE_BUNDLE_ID" DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID"
python3 tools/check_beta_archive.py build/ScorePrep-signed.xcarchive
xcodebuild -exportArchive -archivePath build/ScorePrep-signed.xcarchive \
  -exportPath "$PRIVATE_DIR/export" -exportOptionsPlist "$PRIVATE_DIR/ExportOptions.plist"
# altool searches API_PRIVATE_KEYS_DIR for AuthKey_<id>.p8.
API_PRIVATE_KEYS_DIR="$PRIVATE_DIR" xcrun altool --upload-app --type ios \
  --file "$PRIVATE_DIR/export/ScorePrep.ipa" \
  --apiKey "$APP_STORE_KEY_ID" --apiIssuer "$APP_STORE_ISSUER_ID"
echo 'Upload command accepted. Confirm processing and tester availability in App Store Connect.'
