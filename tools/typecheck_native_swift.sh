#!/usr/bin/env bash
set -euo pipefail

# Check the native practice/reader sources against the actual iPad SDK before
# the large notation dependency compiles. The full Xcode build still verifies
# composition and the Verovio-backed review/rendering views below.
mkdir -p build/native-typecheck
SDK_PATH=$(xcrun --sdk iphonesimulator --show-sdk-path)
xcrun swiftc -swift-version 5 -parse-as-library -emit-module -module-name ScoreCore \
  -sdk "$SDK_PATH" -target arm64-apple-ios18.0-simulator \
  -emit-module-path build/native-typecheck/ScoreCore.swiftmodule \
  Packages/ScoreCore/Sources/ScoreCore/*.swift

SOURCES=()
while IFS= read -r -d '' SOURCE_FILE; do
  SOURCES+=("$SOURCE_FILE")
done < <(find ScoreApp ScoreAudio ScoreRendering ScoreRecognition -type f -name '*.swift' \
  ! -name ScorePrepApp.swift ! -name LibraryView.swift ! -name RecognitionReviewView.swift \
  ! -path 'ScoreRendering/Recognition/*' -print0)

xcrun swiftc -swift-version 5 -parse-as-library -typecheck -module-name ScorePrep -D DEBUG \
  -sdk "$SDK_PATH" -target arm64-apple-ios18.0-simulator \
  -I build/native-typecheck "${SOURCES[@]}"
