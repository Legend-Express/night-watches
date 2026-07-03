# Night Watches — your offline dream journal

A single small web app. All data stays on your phone. No AI, no accounts,
no network needed after setup. Pure keyword logic does the sorting.

## One-time setup (about 10 minutes)

The app needs to be opened over the web ONCE so your iPhone can install it.
After that it works fully offline forever.

1. Create a free account at github.com (if you don't have one).
2. Create a new repository, name it anything (e.g. `night-watches`), set it Public.
3. Upload all 6 files from this folder (drag and drop on the repo page):
   index.html, app.js, sw.js, manifest.webmanifest, icon-180.png, icon-512.png
4. In the repo: Settings → Pages → Source: "Deploy from a branch" → main → Save.
5. After a minute your app is live at  https://YOURNAME.github.io/night-watches/
6. Open that link in **Safari on your iPhone** → tap Share → **Add to Home Screen**.

You now have a "Dreams" app icon. It opens instantly, works in airplane mode,
and everything you write stays only on your device.

> Privacy note: the page itself is public but contains no data — your dreams
> are stored in your phone's local storage, never uploaded anywhere.

## First run

1. Open the app → Settings → **Import from Notes**.
2. In your iPhone Notes, select-all your dream note, copy, paste it in, tap
   Preview, then Import. Every dated entry is detected, categorized, and
   pattern-indexed automatically.
3. Turn on **Prayer notifications** in Settings (allow when asked).
4. Download a **backup** once in a while — it's your journal's insurance.

## Morning flow

Wake → open the app → tap ＋ New → write the dream → Save.
The app instantly files it (warfare / calling / revelation / warning / healing /
family / provision / growth), tags its symbols, detects who appeared, and if
someone seems to be in danger it adds them to the **Prayer Watch** and fires a
notification that stays in your notification centre until you clear it.

## About reminders — the honest part

iPhones do not allow a fully offline app to schedule future notifications
(that requires either a native app or a push server). So reminders work like this:
- The moment you save a danger dream → notification fires immediately.
- Every time you open the app with unprayed alerts → one summary notification per day.
- The Prayer Watch panel is always the first thing on screen.

If you also want a fixed daily nudge (e.g. 06:00 "Log your dream & check the
watch"), create it once in the iPhone **Reminders** app — that runs natively
and offline.
