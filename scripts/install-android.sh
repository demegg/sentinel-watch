#!/usr/bin/env bash
# Install SentinelWatch APK on a USB-connected Android phone.
set -euo pipefail

ADB="${HOME}/.local/android/platform-tools/adb"
APK="${1:-$(dirname "$0")/../_incoming/sentinelwatch-latest.apk}"

if [[ ! -x "$ADB" ]]; then
  echo "adb not found at $ADB"
  echo "Download platform-tools: https://developer.android.com/tools/releases/platform-tools"
  exit 1
fi

if [[ ! -f "$APK" ]]; then
  echo "APK not found: $APK"
  exit 1
fi

export PATH="$(dirname "$ADB"):$PATH"
adb start-server

echo "Waiting for Android device (enable USB debugging + authorize this PC)…"
for i in $(seq 1 30); do
  if adb devices | grep -q 'device$'; then
    break
  fi
  sleep 2
done

if ! adb devices | grep -q 'device$'; then
  echo ""
  echo "No device found. On your phone:"
  echo "  1. Settings → Developer options → USB debugging ON"
  echo "  2. Connect USB → choose File transfer / MTP"
  echo "  3. Tap Allow when prompted for USB debugging"
  echo "  4. Run: adb devices"
  exit 1
fi

echo "Installing $(basename "$APK") …"
adb install -r "$APK"
echo "Done. Open SentinelWatch on your phone."
