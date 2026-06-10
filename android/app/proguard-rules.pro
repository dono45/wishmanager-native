# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo modules used in this project
-keep class expo.modules.sqlite.** { *; }
-keep class expo.modules.securestore.** { *; }
-keep class expo.modules.filesystem.** { *; }
-keep class expo.modules.imagepicker.** { *; }
-keep class expo.modules.crypto.** { *; }
-keep class expo.modules.statusbar.** { *; }
-keep class expo.modules.core.** { *; }

# React Navigation / Screens / SafeArea
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.th3rdwave.** { *; }
-keep class com.facebook.react.views.** { *; }

# Keep React Native modules loaded via reflection
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactContextBaseJavaClass <methods>; }

# Add any project specific keep options here:
