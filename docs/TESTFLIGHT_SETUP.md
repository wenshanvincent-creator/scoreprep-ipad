# First TestFlight beta

Status: native iPhone/iPad checks and the unsigned release archive passed.
See [verification evidence](IPHONE_VERIFICATION.md).
No signed IPA or TestFlight invitation has been created. Developer enrollment
and signing configuration are pending.
The generated exercise works offline without an OMR worker. Recognition still
requires your own authenticated remote worker; no production endpoint is bundled.

## Enrollment when the phone is available

1. The eligible account holder signs in at
   https://developer.apple.com/programs/enroll/ or uses the official Apple
   Developer app. Use their actual legal name, residence and contact details;
   an App Store storefront choice does not establish enrollment eligibility.
2. Enable two-factor authentication in Settings → name → Sign-In & Security.
   Complete Apple's verification on the account holder's own device.
3. If the creator is below the age of majority, a parent/guardian enrolls with
   their own Apple Account, as described on Apple's enrollment page. They are
   the account holder and their legal name is the App Store seller for an
   individual membership. Contact Apple for account-access questions.
4. The account holder reviews and accepts the agreements and membership charge
   themselves. Apple lists US$99/year or the local price. Wait for membership
   activation before creating distribution assets. Do not send passwords,
   two-factor codes or identity documents through project issues or chat.

## Configure after membership activation

The account holder opens Certificates, Identifiers & Profiles, registers an
explicit app identifier, and creates the matching iOS App Store distribution
profile and Apple Distribution certificate. Keep the certificate's private key;
export the certificate plus private key as a password-protected PKCS#12 (.p12).
This can be arranged using a private cloud Mac session; owning a Mac is not
required. Never upload signing assets to public workflow artifacts.

Create an iOS app record in App Store Connect with the same identifier, name
ScorePrep, primary language English, and an owner-chosen unique SKU. The current
source identifier `org.scoreprep.ScorePrep` is provisional until registered.
Create an App Store Connect API key authorized to upload this app (App Manager
or the appropriate permitted role). Download its private .p8 key once and keep
it privately. Changing access/creating credentials requires the account holder.

Create a GitHub environment named `testflight`, restrict it to `main`, and add
required owner approval before release jobs. Environment variables:

| Variable | Value |
| --- | --- |
| APPLE_TEAM_ID | Account holder's developer team ID |
| APPLE_BUNDLE_ID | Registered app identifier matching the app record/profile |

Environment secrets (never repository files or issue comments):

| Secret | Content |
| --- | --- |
| APP_STORE_KEY_ID | App Store Connect API key ID |
| APP_STORE_ISSUER_ID | API issuer ID |
| APP_STORE_PRIVATE_KEY | Complete private .p8 content |
| APPLE_DISTRIBUTION_P12_BASE64 | Base64 of certificate plus private key |
| APPLE_DISTRIBUTION_P12_PASSWORD | Password for that .p12 |
| APPLE_PROFILE_BASE64 | Base64 of matching App Store distribution profile |

The upload lane accepts no branch, arbitrary command or signing input from a PR.
It runs only by manual dispatch on main, inside the environment. Signing assets
use a temporary keychain and directory cleaned on exit. The preparation lane
has no signing secrets and saves an explicitly unsigned archive for inspection.

The privacy manifest declares app-local preferences (CA92.1), elapsed musical
timing (35F9.1), and app-local file metadata (C617.1). Verovio's bundled glyph
and font XML loader uses pugixml's `fstat` file-size path. Apple's required-reason
list includes this API even though the parser reads file size, not timestamps.

## Build, upload and install

1. Review the iPhone simulator gate and unsigned release-archive gate first.
   The release archive must use Xcode 26/iOS 26 SDK or later under Apple's
   current upload requirements. Minimum supported OS remains iOS 18.
2. Run Actions → TestFlight preparation → Run workflow on main. Leave upload
   off for archive-only preparation. Turn it on only after the environment and
   app record are ready. Each run uses its workflow run number as build number;
   start a new dispatch for a new build instead of rerunning an accepted upload.
3. Check App Store Connect → app → TestFlight for processing results, export
   compliance and any validation errors. A successful upload command is not
   proof of processing, review approval or tester availability.
4. For the first owner test, add the eligible App Store Connect user to an
   internal testing group and enable the processed build. For other people,
   complete beta app details and Apple's external beta review before sharing
   an external invitation/public link. Public app release is a separate action.
5. Install Apple's TestFlight on the iPhone, accept the invitation and install
   ScorePrep. Open practice exercise → Practice → Play. Check portrait and
   landscape, touch Pause/Next, audible clicks, import and offline reopen on
   physical hardware before inviting a broader group.

## Authoritative references

- https://developer.apple.com/programs/enroll/
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype
- https://testflight.apple.com/
