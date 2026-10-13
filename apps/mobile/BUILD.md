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
   | `EXPO_PUBLIC_API_URL` | the address of the deployed web app, without a trailing slash (a phone cannot reach `localhost`) |

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

## Check the JavaScript without a build

```bash
cd apps/mobile
EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=x EXPO_PUBLIC_API_URL=https://example.test \
  npx expo export --platform android
```

If this fails, the cloud build will fail too.
