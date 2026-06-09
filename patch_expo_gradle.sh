#!/bin/bash
# Patch all Expo Gradle plugins to be compatible with Gradle 8.5

fix_logger() {
  local file=$1
  local classname=$2
  if grep -q "Unresolved reference 'logger'" /dev/null 2>/dev/null; then
    : # checked via compilation
  fi
  # Replace direct logger usage with Logging.getLogger
  sed -i "s/logger\.error(/Logging.getLogger(${classname}::class.java).error(/g" "$file"
  sed -i "s/logger\.warn(/Logging.getLogger(${classname}::class.java).warn(/g" "$file"
  sed -i "s/logger\.quiet(/Logging.getLogger(${classname}::class.java).quiet(/g" "$file"
  sed -i "s/logger\.info(/Logging.getLogger(${classname}::class.java).info(/g" "$file"
  # Add import if not present and logger is used
  if grep -q "Logging.getLogger" "$file" && ! grep -q "import org.gradle.api.logging.Logging" "$file"; then
    sed -i '1s/^/import org.gradle.api.logging.Logging\n/' "$file"
  fi
}

fix_extra() {
  local file=$1
  # Remove broken import
  sed -i '/import org.gradle.internal.extensions.core.extra/d' "$file"
  # Replace .extra. with .extensions.extraProperties.
  sed -i 's/\.extra\./.extensions.extraProperties./g' "$file"
  # Replace .extra (at end of line or before space/paren) with .extensions.extraProperties
  sed -i 's/\.extra$/.extensions.extraProperties/g' "$file"
  sed -i 's/\.extra /.extensions.extraProperties /g' "$file"
  sed -i 's/\.extra)/.extensions.extraProperties)/g' "$file"
}

fix_extensions() {
  local file=$1
  sed -i '/import org.gradle.internal.extensions.core.extra/d' "$file"
}

echo "=== Patching expo-modules-autolinking ==="

# FindPermissionsToOverride.kt
f1="node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-max-sdk-override-plugin/src/main/kotlin/expo/modules/plugin/FindPermissionsToOverride.kt"
if [ -f "$f1" ]; then
  fix_logger "$f1" "FindPermissionsToOverride"
  echo "  Patched FindPermissionsToOverride.kt"
fi

# ExpoMaxSdkOverridePlugin.kt
f2="node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-max-sdk-override-plugin/src/main/kotlin/expo/modules/plugin/ExpoMaxSdkOverridePlugin.kt"
if [ -f "$f2" ]; then
  fix_logger "$f2" "ExpoMaxSdkOverridePlugin"
  echo "  Patched ExpoMaxSdkOverridePlugin.kt"
fi

# ExpoRootProjectPlugin.kt
f3="node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt"
if [ -f "$f3" ]; then
  fix_extra "$f3"
  echo "  Patched ExpoRootProjectPlugin.kt"
fi

echo "=== Patching expo-modules-core ==="

# ExpoModulesGradlePlugin.kt
f4="node_modules/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/ExpoModulesGradlePlugin.kt"
if [ -f "$f4" ]; then
  fix_extensions "$f4"
  fix_extra "$f4"
  echo "  Patched ExpoModulesGradlePlugin.kt"
fi

# ProjectConfiguration.kt
f5="node_modules/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/ProjectConfiguration.kt"
if [ -f "$f5" ]; then
  fix_extensions "$f5"
  fix_extra "$f5"
  echo "  Patched ProjectConfiguration.kt"
fi

# ExpoModuleExtension.kt
f6="node_modules/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/gradle/ExpoModuleExtension.kt"
if [ -f "$f6" ]; then
  fix_extensions "$f6"
  fix_extra "$f6"
  echo "  Patched ExpoModuleExtension.kt"
fi

echo "=== Done ==="
