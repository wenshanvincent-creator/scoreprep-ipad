"""Choose an available iPad from simctl's JSON output."""
import json
import sys

inventory = json.load(sys.stdin)
for runtime, devices in inventory["devices"].items():
    if ".iOS-" not in runtime:
        continue
    for device in devices:
        if device.get("isAvailable") and "iPad" in device["name"]:
            print(device["udid"])
            sys.exit(0)
sys.exit("No available iPad simulator runtime is installed.")
