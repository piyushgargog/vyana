# Building the Android preview (APK)

The `preview` profile in [`eas.json`](eas.json) builds an installable `.apk` with EAS Build. It uses the real backend (`EXPO_PUBLIC_USE_MOCKS=false`) and takes the other settings from the `preview` environment of the Expo project.

## One time

1. Sign in to Expo with the team account and link the project (this writes `extra.eas.projectId` into `app.json`; commit it through a pull request that the mobile owner approves):

   ```bash
   npx eas-cli login
   npx eas-cli init
   ```

2. Add the three public settings to the **preview** environment of the Expo project (dashboard → Project → Environment variables, or `npx eas-cli env --help` for the command of your version). Visibility: plain text or sensitive. `EXPO_PUBLIC_` values are packed into the app, so never put a secret in them.

   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | the project URL of the Supabase cloud project |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | its anon (public) key |
   | `EXPO_PUBLIC_API_URL` | the address of the deployed web app: `https://vyanahealth.app` (without a trailing slash; a phone cannot reach `localhost`) |

   The service-role key, the TinyFish key and the AI keys belong only to the web deploy.

## Build

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

The build runs in the cloud. When it finishes, EAS prints a link and a QR code for the `.apk`; open it on the phone and allow installs from that source.

## Before it goes on a phone

- The Supabase project has all migrations applied and the seed run (`supabase/README.md`), and its Vault holds `app_url` and `cron_secret` so the missed-dose job works.
- The web app is deployed and `EXPO_PUBLIC_API_URL` points to it.
- Push notifications on Android need the Expo push credentials: `npx eas-cli credentials` (or let the first build offer to set them up).
- Check on the phone: sign in as the demo patient, see the medicines and reminders, scan a prescription, book a token, and open a share link.

## Release: attach the APK to the GitHub Release

1. Build the APK from the final `main` (`npx eas-cli build --platform android --profile preview`) and wait until it is finished (`npx eas-cli build:view <id>`).
2. Tag the release (`git tag v1.0.0 && git push origin v1.0.0`): the release workflow creates the GitHub Release from the matching section of `CHANGELOG.md`.
3. Download the `.apk` from the build page and attach it: `gh release upload v1.0.0 vyana-1.0.0.apk`.

## Before the APK is published or linked anywhere: check its permissions

The 1.0.0 APK asked for the microphone (`RECORD_AUDIO`) and for "draw over
other apps" (`SYSTEM_ALERT_WINDOW`), neither of which the app uses (issue
#377). Both are blocked in `app.json` (`android.blockedPermissions`), and the
image picker is told `microphonePermission: false` so it never asks for the
microphone in the first place. Do not publish or link a build until both
checks below pass.

1. The generated manifest:

   ```bash
   cd apps/mobile
   npx expo prebuild --platform android --no-install
   node ./scripts/check-android-permissions.mjs android/app/src/main/AndroidManifest.xml
   ```

   It must print OK: each blocked permission appears only as a
   `tools:node="remove"` entry, which is what makes the Android manifest
   merger drop the permission even when a library's manifest asks for it.

   The same check runs on every pull request: it is wired into CI as a
   step in the `expo-doctor` job in `.github/workflows/ci.yml`:

   ```yaml
   - name: Blocked Android permissions stay blocked
     working-directory: apps/mobile
     env:
       EXPO_NO_TELEMETRY: "1"
     run: |
       npx expo prebuild --platform android --no-install
       node ./scripts/check-android-permissions.mjs android/app/src/main/AndroidManifest.xml
   ```

2. The built APK itself (the merged manifest is the only ground truth). With
   the Android SDK build-tools on the machine (`aapt` ships with them; EAS
   build machines have them, a release manager's machine needs Android
   Studio or the command-line tools):

   ```bash
   aapt dump permissions vyana-<version>.apk
   ```

   The output must not list `android.permission.RECORD_AUDIO` or
   `android.permission.SYSTEM_ALERT_WINDOW`. (`apkanalyzer manifest
   permissions vyana-<version>.apk` from the Android SDK command-line tools
   prints the same list.) If either appears, do not upload the APK: fix the
   config first and rebuild.

## A pitfall that closed the first APK on launch

React Compiler (`experiments.reactCompiler`) writes `Symbol.for("react.memo_cache_sentinel")` into every compiled component. A file that imports a component called `Symbol` (our icon) hides the built-in `Symbol`, so the call fails with "undefined is not a function" and the app closes. The compiler is off in `app.json`. Before turning it on again, rename the icon component (for example to `SymbolIcon`) in every file. A release build prints no JavaScript error on screen: read the crash with `adb logcat -b events | grep am_crash` on a phone connected by USB or wireless debugging.

## Check the JavaScript without a build

```bash
cd apps/mobile
EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=x EXPO_PUBLIC_API_URL=https://example.test \
  npx expo export --platform android
```

If this fails, the cloud build will fail too.
