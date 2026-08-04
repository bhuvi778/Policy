# App Store submission: 0 → live

This is the non-code part: Apple Developer account, App Store Connect,
Xcode signing, store listing content, and submitting for review. Every step
here requires **your own Apple ID and, for most of it, your own actions in
a browser/Xcode** — an assistant can prepare content and configure the
Xcode project, but account creation, payment, and the final "Submit for
Review" click are yours to do.

## 1. Apple Developer Program enrollment

- Go to [developer.apple.com/programs](https://developer.apple.com/programs/enroll/)
  and enroll with your Apple ID. **$99/year.**
- If enrolling as an organization (not an individual), you'll need a
  D-U-N-S number and legal entity verification — this can take several
  business days. Enrolling as an individual is same-day/next-day typically.
- You do **not** need this to run the app in Simulator or even on your own
  physical device for a few days (Xcode allows free "personal team"
  on-device testing with just an Apple ID) — you only need the paid
  membership for App Store distribution and TestFlight.

## 2. App Store Connect: create the app record

Once enrolled, at [appstoreconnect.apple.com](https://appstoreconnect.apple.com):

1. **My Apps → + → New App.**
2. **Platform:** iOS.
3. **Name:** the public app name shown on the App Store (must be globally
   unique across the whole App Store — "PolicyBhandar" or a close variant).
4. **Primary language, Bundle ID:** select `com.policybhandar` (this must
   already exist as an **Identifier** under **Certificates, Identifiers &
   Profiles** — App Store Connect will prompt you to register it there
   first if it doesn't exist yet).
5. **SKU:** any internal unique string, e.g. `policybhandar-ios-1`.

This creates the shell app record — it isn't visible on the store until
you fill in the listing and submit a build.

## 3. Xcode signing setup

Open `ios/PolicyBhandar.xcworkspace`, select the `PolicyBhandar` target →
**Signing & Capabilities**:

1. Check **Automatically manage signing**.
2. **Team:** select your Apple Developer account/team (appears once you're
   signed into Xcode with your Apple ID — Xcode → Settings → Accounts).
3. Xcode will auto-create the App ID, provisioning profile, and
   distribution certificate the first time you archive.

## 4. Archive & upload a build

See `docs/versioning-releases.md` for the full Archive walkthrough. Short
version: bump the version, select "Any iOS Device (arm64)", **Product →
Archive**, then in the Organizer window **Distribute App → App Store
Connect → Upload**.

The build then takes a few minutes to appear in App Store Connect under
**TestFlight** / the app's **Builds** section (Apple runs an automated
processing + basic compliance check first).

## 5. Store listing content

In App Store Connect, under your app → the version you're preparing:

### App name
Max 30 characters. Shown under the icon everywhere.

### Subtitle
Max 30 characters. Shown right under the name on the app's product page —
your one shot at a value-prop line ("Insurance tools for advisors", etc.).

### Promotional text
Max 170 characters. Unlike the description, this can be updated **without**
a new build submission — good for time-sensitive messaging.

### Description (the "long description")
Max 4000 characters. This is the full pitch — what the app does, who it's
for, key features. Not searchable by Apple's algorithm (keywords field
below is), so write it for humans, not SEO.

### Keywords
Max 100 characters, comma-separated, no spaces needed around commas. This
*is* searchable — this is your ASO (App Store Optimization) lever.

### Support URL (required)
A real, live webpage where users can get help — even a simple contact page
works. `src/screens/ContactUsScreen.js` content can inform this.

### Marketing URL (optional)

### Privacy Policy URL (required)
Apple **requires** a live, publicly accessible URL — not just in-app text.
This app already has `src/screens/PrivacyPolicyScreen.js` with in-app
content; you need that same content (or equivalent) hosted at a public URL
you control (a simple static page works — GitHub Pages, your company site,
etc.). Paste that URL here. It must also match what you declare in the
**App Privacy** section (next).

### App Privacy (data collection disclosure)
A required questionnaire: what data this app collects (this app has
login/registration → likely collects contact info; if it uses analytics,
declare that too) and whether it's linked to the user's identity, used for
tracking, etc. Apple cross-checks this against actual app behavior during
review — under-declaring is a common rejection reason. Go through
`src/services/api.js` and any analytics/crash-reporting SDKs in
`package.json` to answer accurately.

### Age rating
A questionnaire (violence, gambling, user-generated content, etc.) —
straightforward for a business/productivity app like this one.

### Category
Primary + optional secondary, e.g. **Business** or **Finance**.

### Pricing
Free or paid tier, and territory availability.

## 6. Screenshots (required, per device size)

Apple requires screenshots for at least one size in each device family you
support. As of this writing, the required sizes are:

- **6.9" display** (iPhone 17 Pro Max / 16 Pro Max class) — 1320×2868 or 2868×1320
- **6.5" display** (iPhone 11 Pro Max / XS Max class) — 1284×2778 or similar, still accepted for back-compat
- **iPad Pro 13" display** — only if you support iPad (check `UISupportedInterfaceOrientations~ipad` — this project does declare iPad orientations)

Apple auto-scales one size to cover several device classes, but the safest
approach is generating the largest required size per family and letting
App Store Connect scale down.

**How to capture them from this project, once it's fully running:**

```bash
xcrun simctl list devices available | grep "iPhone 17 Pro Max"
xcrun simctl boot "iPhone 17 Pro Max"
npx react-native run-ios --simulator "iPhone 17 Pro Max"
# navigate to each screen you want captured, then:
xcrun simctl io booted screenshot ~/Desktop/screenshot-01-home.png
```

Repeat for an iPad simulator if you support iPad. Pick 3–8 screens that
show the app's actual value (home/dashboard, a key feature screen, the
scan/OCR feature, profile) — not just the login screen.

Optional but common: overlay marketing text/device frames on top of raw
screenshots using a design tool. Not required — plain device screenshots
are accepted and are what Apple's own guidelines recommend leading with.

## 7. Submit for review

Once the build is attached and every required field above is filled:
**Add for Review → Submit to App Review.**

- Typical review time: 24–48 hours (varies).
- Common rejection reasons worth checking *before* submitting: missing/broken
  privacy policy URL, permission usage strings that don't match actual
  behavior (this project's `NSCameraUsageDescription` should read naturally
  for the visiting-card-scan feature — already set), placeholder/test
  content visible in the demo account, crashes on first launch on a fresh
  device.
- If your app requires login to see any content (this one does), Apple
  will ask for **demo account credentials** in the review notes — have a
  working test account ready.

## Where things stand for this project right now

- ✅ iOS app scaffolded and running (see `README.md` / `docs/commands.md`)
- ✅ Native modules ported (see `docs/ios-native-modules.md`)
- ⬜ Apple Developer Program enrollment — needs your Apple ID + payment
- ⬜ App Store Connect app record
- ⬜ Xcode signing (needs your Team selected)
- ⬜ Store listing copy (name/subtitle/description/keywords) — can be
  drafted collaboratively once you're ready
- ⬜ Hosted privacy policy page (content already exists in-app at
  `src/screens/PrivacyPolicyScreen.js` — needs a public URL)
- ⬜ Screenshots — can be captured from Simulator once the UI is
  final/populated with real content
