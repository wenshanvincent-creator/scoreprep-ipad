#!/usr/bin/env bash
set -euo pipefail

mkdir -p build
xcodebuild -version | tee build/xcode-version.txt
python3 tools/prepare_verovio.py
swift package --package-path build/dependencies/verovio describe > build/verovio-package.txt
xcodegen generate --spec project.yml
SIMULATOR_ID=$(xcrun simctl list devices available --json | python3 tools/select_simulator.py)
printf '%s\n' "$SIMULATOR_ID" > build/simulator-id.txt
xcrun simctl bootstatus "$SIMULATOR_ID" -b
xcodebuild test \
  -project ScorePrep.xcodeproj \
  -scheme ScorePrep \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath build/DerivedData \
  -resultBundlePath build/Smoke.xcresult \
  CODE_SIGNING_ALLOWED=NO \
  | tee build/xcodebuild.log
xcrun simctl launch "$SIMULATOR_ID" org.scoreprep.ScorePrep --smoke-test
sleep 2
xcrun simctl io "$SIMULATOR_ID" screenshot build/scoreprep-ipad.png
