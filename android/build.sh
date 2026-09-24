#!/usr/bin/env bash
# Fabrique l'APK sans Gradle, avec les seuls outils du SDK Android.
# Usage : android/build.sh <fichier-apk-de-sortie> [numéro-de-version]
# Variables : ANDROID_HOME (obligatoire), BUILD_TOOLS_VERSION, PLATFORM_VERSION.
set -euo pipefail

OUTPUT_APK="$(realpath -m "${1:?Chemin de l’APK à produire manquant}")"
VERSION_CODE="${2:-1}"
BUILD_TOOLS_VERSION="${BUILD_TOOLS_VERSION:-34.0.0}"
PLATFORM_VERSION="${PLATFORM_VERSION:-34}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_TOOLS="${ANDROID_HOME:?ANDROID_HOME manquant}/build-tools/${BUILD_TOOLS_VERSION}"
ANDROID_JAR="${ANDROID_HOME}/platforms/android-${PLATFORM_VERSION}/android.jar"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

"$BUILD_TOOLS/aapt2" compile --dir "$PROJECT_DIR/res" -o "$BUILD_DIR/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$ANDROID_JAR" \
  --manifest "$PROJECT_DIR/AndroidManifest.xml" \
  --min-sdk-version 26 \
  --target-sdk-version "$PLATFORM_VERSION" \
  --version-code "$VERSION_CODE" \
  --version-name "1.$VERSION_CODE" \
  --java "$BUILD_DIR/generated" \
  -o "$BUILD_DIR/unsigned.apk" \
  "$BUILD_DIR/resources.zip"

mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD_DIR/classes" \
  $(find "$PROJECT_DIR/src" "$BUILD_DIR/generated" -name '*.java')
"$BUILD_TOOLS/d8" --release --min-api 26 --lib "$ANDROID_JAR" --output "$BUILD_DIR/dex" \
  $(find "$BUILD_DIR/classes" -name '*.class')
(cd "$BUILD_DIR/dex" && zip -q -j "$BUILD_DIR/unsigned.apk" classes.dex)

"$BUILD_TOOLS/zipalign" -p -f 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"
# La clé est versionnée volontairement : toutes les versions de l'APK portent la même signature,
# donc une nouvelle version s'installe par-dessus l'ancienne sans perdre les données.
"$BUILD_TOOLS/apksigner" sign \
  --ks "$PROJECT_DIR/semainier.keystore" \
  --ks-pass pass:semainier-lidl \
  --ks-key-alias semainier \
  --out "$OUTPUT_APK" \
  "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" verify "$OUTPUT_APK"
echo "APK prêt : $OUTPUT_APK"
