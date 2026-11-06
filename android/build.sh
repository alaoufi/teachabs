#!/usr/bin/env bash
# Builds the «احتراف التدريس» Android app (a WebView of the trial site) without Gradle.
# Needs: JDK 17+, Android SDK with platforms;android-34 and build-tools;35.0.0 (ANDROID_HOME).
# Signing key: KEYSTORE (default ~/.teachabs-android/release.jks, created on first run) — keep it safe and out of git;
# updates of an installed app must be signed with the same key.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-/opt/android-sdk}"; BT="$SDK/build-tools/35.0.0"; JAR="$SDK/platforms/android-34/android.jar"
KEYSTORE="${KEYSTORE:-$HOME/.teachabs-android/release.jks}"; KEYPASS="${KEYPASS:-teachabs-trial}"
OUT=build; rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/classes" "$OUT/gen"

"$BT/aapt2" compile --dir res -o "$OUT/res/compiled.zip"
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml -o "$OUT/base.apk" --java "$OUT/gen" --auto-add-overlay "$OUT/res/compiled.zip"
javac -source 8 -target 8 -nowarn -encoding UTF-8 -classpath "$JAR" -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java') 2>&1 | grep -v "bootstrap classpath\|source value 8\|target value 8\|To suppress warnings" || true
"$BT/d8" --min-api 24 --lib "$JAR" --output "$OUT" $(find "$OUT/classes" -name '*.class')
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -alias teachabs -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYPASS" -keypass "$KEYPASS" -dname "CN=Teachabs Trial, O=Teachabs, C=SA" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KEYPASS" --ks-key-alias teachabs --out "$OUT/teachabs.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/teachabs.apk" | head -3
echo "APK: $(pwd)/$OUT/teachabs.apk"
