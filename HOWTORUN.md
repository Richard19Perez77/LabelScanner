# How to run Label Scanner

You do **not** have to import the whole React Native project into Android Studio. The normal way is the **terminal**. Android Studio is only needed once to install the Android SDK and an emulator (or to debug the Kotlin camera module).

This app is **Android-only**. Live camera, barcode, and OCR will not run on iOS.

## What actually starts

Two processes:

1. **Metro** — JS bundler. Serves `App.tsx` to the device.
2. **The Android app** — Gradle builds the APK (Kotlin scanner + React Native) and installs it on an emulator or phone.

`npm run android` starts Metro if it is not already running, then builds and installs the app.

## One-time setup

You need all of these on Windows:

| Tool | Why |
| --- | --- |
| Node.js 22+ | Already used by this repo (`node -v`) |
| Android Studio | Installs the SDK, platform tools, and emulator images |
| JDK 17 or 21 | Android Studio’s bundled JBR is enough |
| A device | USB phone with debugging, or an emulator **with Google Play** (ML Kit) |

In Android Studio: **Settings → Languages & Frameworks → Android SDK** and install:

- Android SDK Platform 36 (or the latest installed platform)
- Android SDK Build-Tools
- Android SDK Platform-Tools
- An **AVD with a Google Play icon** (not “Google APIs” only), or use a physical phone

Create `android/local.properties` if it is missing (this file is gitignored):

```
sdk.dir=C:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk
```

This machine already has that path. You can also set a user env var:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

## Run from the terminal (recommended)

1. Start an emulator (**Device Manager** in Android Studio → Play) or plug in a phone with USB debugging.
2. In PowerShell:

```powershell
cd "C:\Users\richa\Documents\programming\react ocr review\LabelScanner"
npm install
npm run android
```

First build downloads Gradle and native libraries. That can take several minutes.

3. On the phone/emulator: **Allow camera**. For a live scan, point at a label. To review without a printed label, tap **Replay saved test images** / **Fixtures**.

If Metro is already running in another terminal, keep it. In a second terminal you can still run `npm run android`.

Useful split (optional):

```powershell
# terminal 1
npm start

# terminal 2
npm run android
```

Reload JS after edits: press `R` in the Metro terminal, or shake the device → Reload.

## Run from Android Studio (optional)

Use this when you want logcat, breakpoints in Kotlin, or to pick a specific emulator.

1. Still start Metro from the terminal:

```powershell
cd "C:\Users\richa\Documents\programming\react ocr review\LabelScanner"
npm start
```

2. In Android Studio: **File → Open** and select the **`LabelScanner/android`** folder (not the parent `react ocr review` folder).
3. Wait for Gradle sync. Pick a device in the toolbar. Press **Run**.

Do not skip Metro in debug. Without it the app installs but the JS bundle never loads (red screen / unable to connect to bundler).

Release APKs can embed the JS bundle and run without Metro. This review project is meant to be run in debug.

## What you should see

1. **Enable camera** — grant permission.
2. Full-screen preview + green **ROI** box (drag to move, corners to resize).
3. Barcodes inside the ROI appear as they are decoded; **BARCODE N ms** updates in the top-right.
4. **Single-shot OCR** captures one still, extracts **Lot Number** and **Expiry Date**, shows **OCR N ms**.
5. **Fixtures** runs the PNGs in `testdata/images` through the same Kotlin module and compares them to `testdata/expected`.

## Tests (no device)

From `LabelScanner`:

```powershell
npm test
```

Android JVM tests (needs a working Gradle wrapper download):

```powershell
npm run test:android
```

## If it fails

**`sdk.dir` / SDK not found**  
Open Android Studio once, install the SDK, then fix `android/local.properties`.

**First install hangs on NDK**  
React Native needs the Android NDK (~700 MB). If the terminal sits on `Preparing "Install NDK"`, install it in Android Studio: **SDK Manager → SDK Tools → NDK (Side by side)** version **27.1.12297006**, then `npm run android` again.

**Gradle zip timeout**  
This project uses Gradle 9.6.1 (cached on this machine). If the wrapper still tries to download a zip and times out, open `LabelScanner/android` in Android Studio and let it sync.

**No emulators / `adb` devices**  
`adb devices` should list one device as `device`. Start an AVD or enable USB debugging.

**ML Kit / barcode never fires on emulator**  
Use a **Google Play** system image. Then use **Fixtures** to prove extraction without a camera image.

**Red box: unable to load script**  
Metro is not running, or the device cannot reach the PC. `npm start`, then reload. On a physical phone, same Wi‑Fi, or `adb reverse tcp:8081 tcp:8081`.

**Camera permission denied**  
App settings → Label Scanner → Camera → Allow. Fixtures still work without the camera.

**Path with spaces**  
The repo lives under `react ocr review`. If Gradle misbehaves, open the `android` module from Android Studio rather than copying the project.
