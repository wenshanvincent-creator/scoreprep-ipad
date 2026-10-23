#!/usr/bin/env bash
set -euo pipefail
mkdir -p build
xcodebuild -version | tee build/beta-xcode-version.txt
SDK_MAJOR=$(xcrun --sdk iphoneos --show-sdk-version | cut -d. -f1)
if (( SDK_MAJOR < 26 )); then
  echo 'TestFlight requires the iOS 26 SDK or later.' >&2
  exit 1
fi
python3 tools/prepare_verovio.py
xcodegen generate --spec project.yml
BUILD_NUMBER="${GITHUB_RUN_NUMBER:-1}"
xcodebuild archive -project ScorePrep.xcodeproj -scheme ScorePrep \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/ScorePrep-unsigned.xcarchive \
  -derivedDataPath build/BetaDerivedData \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" CODE_SIGNING_ALLOWED=NO \
  | tee build/beta-archive.log
python3 tools/check_beta_archive.py build/ScorePrep-unsigned.xcarchive
ditto -c -k --keepParent build/ScorePrep-unsigned.xcarchive build/ScorePrep-unsigned.zip
