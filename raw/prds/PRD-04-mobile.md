# PRD-04 — VinylDeck: Mobile App (Android + iOS, Tauri v2)

**Version:** 1.0  
**Date:** 2026-06-08  
**Depends on:** PRD-01, PRD-02, PRD-03  
**Platform:** Android 8+ / iOS 15+  
**Phase:** 2 (build after Phase 1 desktop is complete and stable)

---

## 1. Why Tauri v2 for Mobile (Not React Native)

Tauri v2 officially supports Android and iOS as first-class targets since v2.0.0 stable (October 2024). This means the same React frontend and the same Rust backend architecture from Phase 1 (desktop) extends directly to mobile with platform-specific plugins for media access.

**Do not build a separate React Native or native Swift/Kotlin app.** That doubles the codebase and defeats the entire architecture strategy. The Visual Engine (PRD-02) is React — it runs on mobile WebView without modification, except layout.

### What Changes for Mobile

| Concern | Desktop | Mobile |
|---|---|---|
| Media source | SMTC (Rust/WinRT) | Android MediaSession / iOS MPNowPlayingInfoCenter |
| Window modes | Main / Fullscreen / Mini | Single window, portrait-first |
| System tray | Yes | No |
| Always-on-top | Yes | No |
| Keyboard shortcuts | Yes | No (use touch gestures) |
| Layout | 16:9, landscape-optimized | Portrait-first, vinyl centered |
| Mini player | Floating window | Not applicable (OS handles this via notification) |

---

## 2. Tauri v2 Mobile Setup

### 2.1 Prerequisites

```bash
# Android
rustup target add aarch64-linux-android armv7-linux-androideabi
# Requires: Android Studio, Android NDK, JAVA_HOME set

# iOS (macOS only — you need a Mac to build iOS)
rustup target add aarch64-apple-ios x86_64-apple-ios
# Requires: Xcode, Apple Developer account
```

### 2.2 Initialize Mobile Targets

```bash
# In the existing vinyldeck/ project directory
npm run tauri android init
npm run tauri ios init

# Dev
npm run tauri android dev
npm run tauri ios dev

# Build
npm run tauri android build
npm run tauri ios build
```

Tauri generates the native Android (Gradle/Kotlin) and iOS (Xcode/Swift) project structures under `src-tauri/gen/android/` and `src-tauri/gen/apple/`. You write Rust plugins that bridge to native OS APIs, just like on desktop.

---

## 3. Media Source: Android

### 3.1 How Android MediaSession Works

Android exposes currently-playing media via `MediaSessionManager` (API 21+). An app with `MEDIA_CONTENT_CONTROL` permission can enumerate all active `MediaController` instances and read their metadata.

**Critical note:** `MEDIA_CONTENT_CONTROL` is a protected permission. It requires either:
- Notification access (user grants in Settings → Special App Access → Notification Access)
- Or the app being a system-level app

The practical approach: use **Notification Listener Service** to read `MediaSession` tokens from notifications. This is the same approach that apps like LastFM Scrobbler, Spotify miniplayer widgets, and other "now playing" apps use.

### 3.2 Rust-to-Kotlin Bridge via Tauri Android Plugin

```
Tauri Frontend (React)
       ↓ invoke("get_android_media")
Rust (src-tauri/src/media/android.rs)
       ↓ calls Kotlin via JNI / Tauri's mobile plugin system
Kotlin (NotificationListenerService + MediaController)
       ↓ returns MediaSnapshot
```

### 3.3 Kotlin: Notification Listener Service

The `MediaNotificationListenerService.kt` must be declared in `AndroidManifest.xml` and granted Notification Access by the user.

```kotlin
// src-tauri/gen/android/app/src/main/java/com/vinyldeck/app/MediaNotificationListenerService.kt

import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.graphics.Bitmap
import android.util.Base64
import java.io.ByteArrayOutputStream

class MediaNotificationListenerService : NotificationListenerService() {

    companion object {
        var instance: MediaNotificationListenerService? = null
    }

    override fun onListenerConnected() {
        instance = this
    }

    override fun onListenerDisconnected() {
        instance = null
    }

    fun getCurrentMediaSnapshot(): Map<String, Any?>? {
        val sessionManager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
        val controllers = try {
            sessionManager.getActiveSessions(
                android.content.ComponentName(this, MediaNotificationListenerService::class.java)
            )
        } catch (e: SecurityException) {
            return null   // Permission not granted yet
        }

        val controller = controllers.firstOrNull() ?: return null
        val metadata = controller.metadata ?: return null
        val playbackState = controller.playbackState

        val isPlaying = playbackState?.state ==
            android.media.session.PlaybackState.STATE_PLAYING

        val artworkBitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)

        val artworkDataUrl: String? = artworkBitmap?.let { bmp ->
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
            val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            "data:image/jpeg;base64,$b64"
        }

        val durationMs = metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)
        val positionMs = playbackState?.position ?: 0L

        return mapOf(
            "track"             to (metadata.getString(MediaMetadata.METADATA_KEY_TITLE) ?: ""),
            "artist"            to (metadata.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: ""),
            "album"             to (metadata.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""),
            "artwork_data_url"  to artworkDataUrl,
            "duration_secs"     to (durationMs / 1000.0),
            "position_secs"     to (positionMs / 1000.0),
            "is_playing"        to isPlaying,
            "source_name"       to (controller.packageName ?: ""),
            "source_id"         to (controller.packageName ?: ""),
            "can_play"          to true,
            "can_pause"         to true,
            "can_skip_next"     to true,
            "can_skip_prev"     to true,
            "can_seek"          to (playbackState?.actions?.and(
                android.media.session.PlaybackState.ACTION_SEEK_TO) != 0L),
        )
    }

    fun sendCommand(command: String, positionMs: Long = 0) {
        val sessionManager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
        val controllers = try {
            sessionManager.getActiveSessions(
                android.content.ComponentName(this, MediaNotificationListenerService::class.java)
            )
        } catch (e: SecurityException) { return }

        val controller = controllers.firstOrNull()?.transportControls ?: return

        when (command) {
            "play"     -> controller.play()
            "pause"    -> controller.pause()
            "toggle"   -> { /* check state and call play or pause */ }
            "next"     -> controller.skipToNext()
            "previous" -> controller.skipToPrevious()
            "seek"     -> controller.seekTo(positionMs)
        }
    }
}
```

### 3.4 AndroidManifest.xml Additions

```xml
<!-- Add inside <application> tag -->
<service
    android:name=".MediaNotificationListenerService"
    android:label="VinylDeck Media Listener"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

### 3.5 Permission Prompt Flow (Android)

On first launch (Android):
1. Detect if Notification Access is granted: `NotificationManagerCompat.getEnabledListenerPackages(context).contains(packageName)`
2. If not granted: show a permission prompt screen in the app UI explaining why it's needed
3. Deep link to `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`
4. On return: re-check permission

```typescript
// src/views/PermissionPromptView.tsx
// Only shown on Android when permission is missing
// Shows: "VinylDeck needs Notification Access to see what's playing"
// Button: "Grant Access" → opens Android settings
// After granting: user returns to app, permission is detected, app loads normally
```

---

## 4. Media Source: iOS

### 4.1 How iOS MPNowPlayingInfoCenter Works

iOS provides `MPNowPlayingInfoCenter` which exposes the currently-playing app's metadata. Unlike Android, this does NOT require special permissions for reading — it's a global system API.

However, iOS is more restrictive about CONTROLLING other apps' playback. `MPRemoteCommandCenter` allows your app to intercept media commands, but controlling a different app's playback is done via `MPRemoteCommand` events.

**Important iOS limitation:** iOS does not expose other apps' media sessions the same way Android does. `MPNowPlayingInfoCenter.default().nowPlayingInfo` gives you the current system-wide now-playing info, which is usually the last app that registered with the remote command center. This works for Spotify, Apple Music, and most music apps.

### 4.2 Swift: Media Reader

```swift
// src-tauri/gen/apple/Sources/VinylDeck/MediaReader.swift

import MediaPlayer
import UIKit

class MediaReader {
    static func getCurrentSnapshot() -> [String: Any?] {
        let center = MPNowPlayingInfoCenter.default()
        guard let info = center.nowPlayingInfo else {
            return [:]
        }

        let title    = info[MPMediaItemPropertyTitle] as? String ?? ""
        let artist   = info[MPMediaItemPropertyArtist] as? String ?? ""
        let album    = info[MPMediaItemPropertyAlbumTitle] as? String ?? ""
        let duration = info[MPMediaItemPropertyPlaybackDuration] as? Double ?? 0.0
        let position = info[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double ?? 0.0
        let rate     = info[MPNowPlayingInfoPropertyPlaybackRate] as? Double ?? 0.0
        let isPlaying = rate > 0.0

        // Artwork
        var artworkDataUrl: String? = nil
        if let artwork = info[MPMediaItemPropertyArtwork] as? MPMediaItemArtwork {
            let size = CGSize(width: 300, height: 300)
            if let image = artwork.image(at: size),
               let jpegData = image.jpegData(compressionQuality: 0.85) {
                let b64 = jpegData.base64EncodedString()
                artworkDataUrl = "data:image/jpeg;base64,\(b64)"
            }
        }

        return [
            "track":            title,
            "artist":           artist,
            "album":            album,
            "artwork_data_url": artworkDataUrl,
            "duration_secs":    duration,
            "position_secs":    position,
            "is_playing":       isPlaying,
            "source_name":      "Now Playing",
            "source_id":        "ios-now-playing",
            "can_play":         true,
            "can_pause":        true,
            "can_skip_next":    true,
            "can_skip_prev":    true,
            "can_seek":         false,  // iOS doesn't expose seek to other apps
        ]
    }

    static func sendCommand(_ command: String) {
        // iOS: send remote control events to the system
        // These are routed to whatever app currently has audio focus
        let shared = UIApplication.shared
        switch command {
        case "play":
            // UIApplication.shared doesn't have sendAction for media directly.
            // Use MPRemoteCommandCenter to trigger the event:
            MPRemoteCommandCenter.shared().playCommand.isEnabled = true
            // Actual control: inject remote control events via UIEvent
            // (This works for MPRemoteCommandCenter subscribers — Spotify, Apple Music, etc.)
            break
        case "pause":
            break
        case "next":
            MPRemoteCommandCenter.shared().nextTrackCommand.isEnabled = true
            break
        case "previous":
            MPRemoteCommandCenter.shared().previousTrackCommand.isEnabled = true
            break
        default:
            break
        }
        // Note: Fully controlling other apps' playback on iOS is limited.
        // The recommended approach is AVAudioSession.sharedInstance() events,
        // but this only works for apps that properly resign audio session.
        // For now, play/pause is the most reliably controllable action.
    }
}
```

**Honest iOS limitation note:** iOS is intentionally restrictive about third-party apps controlling each other. Play/pause via the hardware media keys route usually works. Skip next/previous sometimes works. Seek does not work without using the Spotify SDK or Apple Music framework directly. VinylDeck's value on iOS is the visual experience, not control — users will use the source app's controls for anything advanced.

---

## 5. Mobile Layout (Visual Engine Adaptation)

The React frontend needs a portrait layout. Detect platform and render accordingly.

### 5.1 Platform Detection

```typescript
// src/lib/platform.ts

export type Platform = "windows" | "android" | "ios" | "dev";

export async function detectPlatform(): Promise<Platform> {
  if (import.meta.env.DEV) return "dev";
  try {
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = await platform();
    return p as Platform;
  } catch {
    return "dev";
  }
}
```

### 5.2 Portrait Layout Spec

On Android and iOS, the main layout is portrait-first:

```
┌─────────────────┐
│  [Source Badge] │  ← top right, 11px
│                 │
│  ┌─────────┐   │
│  │ ambient │   │
│  │  layer  │   │
│  └─────────┘   │
│                 │
│   [ VINYL ]     │  ← 75vmin, centered
│  [ NEEDLE ]     │
│                 │
│  Track Title    │  ← 18px, centered
│  Artist · Album │  ← 13px, centered
│                 │
│  ⏮  ⏯  ⏭       │  ← playback controls
│                 │
│  ─── ━━━ ───   │  ← progress bar (horizontal, not ring — more thumb-friendly)
│                 │
│  [⚙] [Theme]   │  ← settings and theme toggle
└─────────────────┘
```

**Key differences from desktop:**
- Progress ring → horizontal scrub bar (easier to tap)
- Vinyl size: `75vmin` (fills width on phone, shorter on iPad)
- Needle arm: show it, but smaller, offset to the right
- No mini player mode (OS handles minification)
- Swipe left/right on vinyl: skip previous/next track (gesture)
- Swipe up: enter fullscreen mode

### 5.3 Mobile Gesture Handling

```typescript
// src/hooks/useMobileGestures.ts

// Use pointer events (works on both touch and mouse)
// On the vinyl element:
//   - Swipe left  (dx < -50, |dy| < 30): next track
//   - Swipe right (dx > 50, |dy| < 30): previous track
//   - Swipe up    (dy < -60, |dx| < 30): toggle fullscreen
//   - Tap center: toggle play/pause
//
// Note: Keep gesture thresholds generous (50px) for thumb-friendliness.
// Avoid swipe-down (conflict with iOS notification shade and Android nav gestures).
```

### 5.4 Progress Bar (Mobile)

On mobile, replace the SVG progress ring with a simple horizontal bar:

```typescript
// src/components/ProgressBar/index.tsx  (mobile only)

// <input type="range" min={0} max={duration} value={position}
//   onChange={(e) => source.seekTo(Number(e.target.value))}
//   disabled={!canSeek}
//   style={{ width: "80%", accentColor: "var(--ui-accent)" }}
// />
//
// Style the input[type=range] with CSS to look premium.
// Range input is accessible and handles all pointer events correctly.
```

---

## 6. Mobile-Specific Rust Commands

Add platform-conditional commands in `src-tauri/src/media/mod.rs`:

```rust
// Conditional compilation for mobile
#[cfg(target_os = "android")]
pub mod android;

#[cfg(target_os = "ios")]
pub mod ios;

// The Tauri commands work the same way — they just call different
// platform-specific implementations under the hood.
// The frontend never needs to know which platform it's on
// (except for layout differences).
```

---

## 7. Mobile Polling Approach

Same 500ms polling loop as desktop, but calling the Android/iOS media reader instead of SMTC.

```rust
// src-tauri/src/media/android.rs

#[tauri::command]
pub fn get_android_media_snapshot(app: AppHandle) -> Result<Option<MediaSnapshot>, String> {
    // Call into Kotlin via Tauri's Android plugin system (JNI)
    // Returns the result of MediaNotificationListenerService.getCurrentSnapshot()
    // Convert the Kotlin Map to Rust MediaSnapshot struct
    // Return None if service not connected or permission denied
    todo!("Implement via Tauri Android plugin JNI bridge")
}
```

The Tauri Android plugin documentation for calling Kotlin from Rust is at:  
`https://v2.tauri.app/develop/plugins/develop-mobile/`

The Kotlin → Rust bridge uses Tauri's `plugin` system which generates JNI bindings automatically.

---

## 8. Mobile App Configuration

### 8.1 `tauri.conf.json` Mobile Additions

```json
{
  "bundle": {
    "android": {
      "minSdkVersion": 26,
      "targetSdkVersion": 34,
      "permissions": [
        "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
      ]
    },
    "iOS": {
      "minimumSystemVersion": "15.0"
    }
  }
}
```

### 8.2 `Info.plist` Additions (iOS)

```xml
<!-- Background audio — required for iOS to keep polling when app is backgrounded -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>fetch</string>
</array>
```

---

## 9. No-Media State on Mobile

Same as desktop: show vinyl in idle state, display "Open any music app to start playing." On Android: if the Notification Listener permission hasn't been granted, show the permission prompt view instead of the idle state.

---

## 10. Features Explicitly Excluded from Mobile Phase 2

These are desktop-only features and will NOT be built for mobile in Phase 2:

- System tray
- Always-on-top window mode
- Mini player (separate window)
- Keyboard shortcuts
- Multiple window modes
- Wallpaper mode
- Transparent window

Mobile Phase 2 is: same cinematic vinyl visual, working media integration, touch gestures. Nothing more.

---

## 11. Future Mobile Consideration: Lock Screen Widget

Both Android 12+ (App Widgets) and iOS 16+ (Live Activities / Lock Screen Widgets) support media widgets. These are complex native features that require significant platform-specific native code. They are Phase 3+ for mobile. Do not attempt them in Phase 2.

---

## 12. Phase 2 Build Order

1. Get Phase 1 (Windows desktop) working and stable first. This is non-negotiable.
2. Initialize Tauri Android target: `npm run tauri android init`
3. Implement the Android Notification Listener Service (Kotlin)
4. Implement the Rust-Kotlin bridge for media snapshot
5. Add the portrait layout to the React frontend (CSS breakpoints + platform detection)
6. Test on Android emulator, then real device
7. Initialize Tauri iOS target (requires macOS): `npm run tauri ios init`
8. Implement Swift media reader for iOS
9. Test on iOS Simulator, then real device
