#!/usr/bin/env bash
set -euo pipefail
mkdir -p build
python3 tools/prepare_verovio.py
xcodegen generate --spec project.yml
# Match Vincent's iPhone 13 viewport using a real simulator device type.
RUNTIME=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys; r=[r for r in json.load(sys.stdin)["runtimes"] if r.get("isAvailable") and r["name"].startswith("iOS 26")]; print(r[-1]["identifier"])')
SIMULATOR_ID=$(xcrun simctl create ScorePrep-iPhone-13 com.apple.CoreSimulator.SimDeviceType.iPhone-13 "$RUNTIME")
printf '%s\n' "$SIMULATOR_ID" > build/iphone-simulator-id.txt
xcrun simctl bootstatus "$SIMULATOR_ID" -b
trap 'if [ -d build/IPhone.xcresult ]; then xcrun xcresulttool export attachments --path build/IPhone.xcresult --output-path build/iphone-attachments; fi' EXIT
xcodebuild test -project ScorePrep.xcodeproj -scheme ScorePrep \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath build/IPhoneDerivedData -resultBundlePath build/IPhone.xcresult \
  -only-testing:ScorePrepUITests/IPhoneCompatibilityTests \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual \
  | tee build/iphone-test.log
