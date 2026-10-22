#!/usr/bin/env bash
set -euo pipefail

mkdir -p build
xcodebuild -version | tee build/xcode-version.txt
test "$(head -1 build/xcode-version.txt)" = 'Xcode 16.4'
python3 tools/prepare_verovio.py
swift package --package-path build/dependencies/verovio describe > build/verovio-package.txt
xcodegen generate --spec project.yml
SIMULATOR_ID=$(xcrun simctl list devices available --json | python3 tools/select_simulator.py)
printf '%s\n' "$SIMULATOR_ID" > build/simulator-id.txt
xcrun simctl bootstatus "$SIMULATOR_ID" -b
trap 'if [ -d build/Smoke.xcresult ]; then xcrun xcresulttool export attachments --path build/Smoke.xcresult --output-path build/attachments; fi' EXIT
xcodebuild test \
  -project ScorePrep.xcodeproj \
  -scheme ScorePrep \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath build/DerivedData \
  -resultBundlePath build/Smoke.xcresult \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual \
  | tee build/xcodebuild.log
codesign -d --entitlements :- build/DerivedData/Build/Products/Debug-iphonesimulator/ScorePrep.app \
  > build/simulator-entitlements.plist
xcrun simctl launch "$SIMULATOR_ID" org.scoreprep.ScorePrep --smoke-test
sleep 2
xcrun simctl io "$SIMULATOR_ID" screenshot build/scoreprep-ipad.png
