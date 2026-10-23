"""Inspect the actual release bundle before signing or upload."""
import json
from pathlib import Path
import plistlib
import sys

archive = Path(sys.argv[1])
app = archive / "Products/Applications/ScorePrep.app"
with (app / "Info.plist").open("rb") as stream:
    info = plistlib.load(stream)
assert set(info["UIDeviceFamily"]) == {1, 2}, "Archive must support iPhone and iPad"
assert info["MinimumOSVersion"] == "18.0", "Keep the existing minimum OS"
assert int(info["DTSDKName"].removeprefix("iphoneos").split(".")[0]) >= 26
assert info["CFBundleIcons"]["CFBundlePrimaryIcon"]["CFBundleIconName"] == "AppIcon"
assert (app / "Assets.car").is_file(), "Compiled app icon is required"
with (app / "PrivacyInfo.xcprivacy").open("rb") as stream:
    privacy = plistlib.load(stream)
reasons = {item["NSPrivacyAccessedAPIType"]: item["NSPrivacyAccessedAPITypeReasons"]
           for item in privacy["NSPrivacyAccessedAPITypes"]}
assert "35F9.1" in reasons["NSPrivacyAccessedAPICategorySystemBootTime"]
assert "CA92.1" in reasons["NSPrivacyAccessedAPICategoryUserDefaults"]
assert "C617.1" in reasons["NSPrivacyAccessedAPICategoryFileTimestamp"]
receipt = {key: info[key] for key in ["CFBundleIdentifier", "CFBundleShortVersionString",
    "CFBundleVersion", "UIDeviceFamily", "MinimumOSVersion", "DTSDKName"]}
receipt["distributionStatus"] = ("signed archive; upload and processing not verified"
    if (app / "embedded.mobileprovision").exists()
    else "unsigned archive; not installable and not uploaded")
output = Path("build/beta-archive-receipt.json")
output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(output.read_text(encoding="utf-8"))
