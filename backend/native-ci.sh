#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/recognition-native backend/native-harness/Resources
test "$(xcodebuild -version | head -1)" = 'Xcode 16.4'
cp build/recognition/job.json backend/native-harness/Resources/job.json
xcodegen generate --spec project.yml
SIMULATOR_ID=$(xcrun simctl list devices available --json | python3 tools/select_simulator.py)
xcrun simctl bootstatus "$SIMULATOR_ID" -b
xcodebuild test -project ScorePrep.xcodeproj -scheme RecognitionHarness \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath build/RecognitionDerivedData \
  -resultBundlePath build/recognition-native/Recognition.xcresult \
  CODE_SIGNING_ALLOWED=NO | tee build/recognition-native/xcodebuild.log
xcrun xcresulttool export attachments --path build/recognition-native/Recognition.xcresult \
  --output-path build/recognition-native/attachments
