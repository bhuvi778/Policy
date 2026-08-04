# App Store submission: every value, ready to paste

This doc has the actual content for every field App Store Connect asks
for — not just a description of the fields. Where something needs *your*
action (payment, clicking Submit, picking a Team in Xcode), that's called
out explicitly. Everything else below is ready to copy in as-is.

## ⚠️ Read this before doing anything else: the subscription payment flow will likely get this app rejected

`SubscriptionPlansScreen.js` → `PaymentWebViewScreen.js` charges for
subscriptions (₹50–₹100/month, unlocking marketing content/downloads)
through **Razorpay inside a WebView**. Apple's App Store Review Guideline
**3.1.1 (In-App Purchase)** requires that unlocking digital content or
services *inside* an iOS app be sold through Apple's own In-App Purchase
(IAP/StoreKit), not a third-party processor like Razorpay — this is one of
the single most common iOS rejection reasons, and reviewers test the
purchase flow directly.

You have three realistic options, and this needs a decision before you
submit — not after a rejection:

1. **Add StoreKit/IAP for iOS.** Keep Razorpay on Android, add a native
   In-App Purchase flow for the same subscription tiers on iOS (Apple
   takes a 15–30% cut). This is the compliant, store-approved path and the
   one Apple expects. It's real engineering work — a new Phase, not a
   config change — happy to scope it whenever you're ready.
2. **Make the iOS build free / remove paid unlock from the iOS app**,
   keeping the paid tier Android-only for now. Simplest to ship, but loses
   iOS revenue.
3. **Argue an exception applies** (e.g. 3.1.3(b) "multiplatform services" —
   generally only covers *existing* subscriptions purchased elsewhere, not
   new iOS purchases; unlikely to apply cleanly here). Don't bank on this
   without reading Apple's current guideline text yourself — it's the
   riskiest path and reviewers reject on this constantly.

Everything else in this doc (listing copy, screenshots, signing) is ready
regardless of which option you pick — but **don't submit for review until
this is resolved**, or expect a rejection on the first pass.

## 1. Apple Developer Program — your action

You're already mid-flow on this (registering the App ID in the
screenshot). Continue there:

- **Bundle ID to register:** `com.policybhandar` (Explicit, not Wildcard)
  — this must exactly match `PRODUCT_BUNDLE_IDENTIFIER` in
  `ios/PolicyBhandar.xcodeproj/project.pbxproj`, which is already set to
  this value.
- **Description field:** `PolicyBhandar` (already filled in your
  screenshot — fine as-is).
- **Capabilities:** none need enabling for this app's current feature set
  (no Push Notifications, Sign in with Apple, HealthKit, etc. in the
  codebase) — leave every checkbox unchecked and click **Continue → Register**.

If you later add IAP (see the warning above), you'll need to come back
here and enable the **In-App Purchase** capability on this App ID.

## 2. App Store Connect — app record

**My Apps → + → New App**, then:

| Field | Value |
|---|---|
| Platform | iOS |
| Name | `PolicyBhandar` |
| Primary language | English (India) — or English (U.S.) if not offered |
| Bundle ID | `com.policybhandar` (select the one you just registered) |
| SKU | `policybhandar-ios-001` |

## 3. Xcode signing — your action

`ios/PolicyBhandar.xcworkspace` → target **PolicyBhandar** → **Signing &
Capabilities**:
- Check **Automatically manage signing**
- **Team:** pick your account (Xcode → Settings → Accounts must have your
  Apple ID signed in first — the "Prashant Jha" account from your Apple
  Developer screenshot)

Xcode creates the certificate/profile automatically on first Archive.

## 4. Store listing copy — ready to paste

### App Name (30 char max)
```
PolicyBhandar
```

### Subtitle (30 char max)
```
Insurance Advisor Business Hub
```

### Promotional text (170 char max — editable without a new build)
```
Marketing content, digital visiting cards, prospect tracking, and training — everything an insurance advisor needs, in one app. New content added regularly.
```

### Description (4000 char max)
```
PolicyBhandar is India's complete business builder app for insurance advisors, mutual fund advisors, insurance leaders, agency managers, trainers, and business builders.

Whether your goal is to generate more business, recruit more advisors, improve your digital presence, or become a recognized industry expert, PolicyBhandar gives you the right knowledge, tools, and content in one place.

WHAT YOU GET
• Ready-to-use marketing materials, banners, and presentations organized by category
• WhatsApp-ready marketing content you can share in one tap
• A visiting-card scanner that auto-fills prospect names and numbers from a photo
• Prospect and client management, with reminders for renewals and follow-ups
• A premium calendar to track policy due dates
• Digital business cards to share your profile professionally
• Training resources and updated product knowledge
• A personal profile you control, with your own branding on shared content

BUILT FOR
Insurance advisors, mutual fund advisors, insurance leaders, agency managers, trainers, and anyone building an insurance or financial services business.

PolicyBhandar is designed to bridge the gap between traditional selling and modern digital business building — structured, mobile-first resources that save time, improve productivity, and help you grow.

Some features require an active subscription. Subscription plans, pricing, and validity are shown in the app.

Support: info@policybhandar.in
```

### Keywords (100 char max, comma-separated)
```
insurance,advisor,LIC,agent,policy,mutual fund,CRM,recruitment,training,marketing,digital card
```

### Category
- Primary: **Business**
- Secondary: **Finance**

### Age rating
Answer "None" to every content question (violence, mature/suggestive
content, gambling, horror, drugs) — this is a B2B business tool with no
such content. Note the app does let advisors enter their own clients'
contact details ("User Generated Content" in Apple's sense is more about
public UGC like comments/forums — this isn't that, but flag "no" to UGC
questions since there's no public posting/sharing between strangers).
Expected result: **4+**.

### Support URL (required)
Host `legal/support.html` from this repo (see hosting steps below), or
use your own existing support page if you have one.

### Marketing URL (optional)
Can be left blank, or point at the same hosted page.

### Privacy Policy URL (required)
Host `legal/privacy-policy.html` from this repo (see below). This is
**required** and must be a real, live URL — App Store Connect will not
accept a blank field or an in-app-only policy.

## 5. Hosting the legal pages (GitHub Pages, using your existing repo)

Three ready-to-publish pages already exist in this repo at `legal/`:
`privacy-policy.html`, `terms.html`, `support.html` — written from the
same content already in `src/screens/PrivacyPolicyScreen.js` and
`TermsScreen.js`, adapted for a public web page.

They're kept in `legal/` rather than `docs/` deliberately — `docs/` has
internal engineering notes (commands, architecture) you don't necessarily
want to publish as public web pages; `legal/` is just the two/three pages
Apple and your users need to see.

**To publish them (GitHub Pages, ~2 minutes):**

1. On GitHub: your repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. **Branch:** `main`, **Folder:** `/legal` (if `/legal` isn't offered in
   the folder dropdown, use `/docs` instead — GitHub Pages only supports
   serving from repo root or a folder literally named `docs`; in that
   case, tell me and I'll move these three files into `docs/legal/` so the
   internal docs aren't mixed in with the public path, or just accept that
   `docs/*.md` renders as plain text/404s via Pages, which is harmless —
   only `.html` files actually render as pages).
4. Save. GitHub gives you a URL like:
   ```
   https://bhuvi778.github.io/Policy/privacy-policy.html
   https://bhuvi778.github.io/Policy/terms.html
   https://bhuvi778.github.io/Policy/support.html
   ```
5. Paste the `privacy-policy.html` URL into App Store Connect's **Privacy
   Policy URL** field, and the `support.html` URL into **Support URL**.

If GitHub Pages only lets you pick `/docs` as the source folder in your
repo's Pages settings (this varies by GitHub's current UI), tell me and
I'll move the three files under `docs/legal/` and update this doc's URLs
to match — a one-line change either way.

## 6. App Privacy questionnaire — concrete answers

Based on what the code actually collects (checked `RegisterScreen.js`,
`ContactUsScreen.js`, `MyProfileScreen.js`, `ScanScreen.js`,
`SubscriptionPlansScreen.js` — no analytics/crash-reporting SDK is present
in `package.json` as of this writing, so answer "Data Not Collected" for
Analytics and Diagnostics unless you've added one since):

| Data type | Collected? | Linked to identity? | Purpose |
|---|---|---|---|
| Name | Yes | Yes | App Functionality, Account creation |
| Phone Number | Yes | Yes | App Functionality (login is mobile-number based), Account creation |
| Email Address | Yes | Yes | App Functionality, Customer Support |
| Physical Address | Yes (PIN code) | Yes | App Functionality |
| Photos | Yes (profile photo, scanned visiting cards) | Yes | App Functionality |
| Other User Content | Yes (client/prospect records advisors enter) | Yes | App Functionality |
| User ID | Yes (auth token) | Yes | App Functionality |
| Payment Info | Yes (via Razorpay) | Yes | App Functionality (Payments) |
| Precise/Coarse Location | No | — | — |
| Contacts (device address book) | No — app does not read the device contact list | — | — |
| Analytics/Usage Data | No SDK detected — re-check if you add one later | — | — |
| Diagnostics/Crash Data | No SDK detected — re-check if you add one later | — | — |

Declare "Data Used to Track You" = **No** for all of the above — nothing
in this codebase does cross-app/cross-site ad tracking.

## 7. Archive & upload

See `docs/versioning-releases.md` for the full walkthrough:
bump `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` → select "Any iOS
Device (arm64)" → **Product → Archive** → Organizer → **Distribute App →
App Store Connect → Upload**.

## 8. Screenshots

Required sizes as of this writing: **6.9" display** (iPhone 17 Pro Max
class) at minimum; add iPad sizes only if you keep iPad orientations
enabled (this project currently declares
`UISupportedInterfaceOrientations~ipad` in `Info.plist`, so plan for at
least one iPad size too, or remove iPad orientation support if you don't
want to shoot iPad screenshots).

```bash
xcrun simctl boot "iPhone 17 Pro Max"
npx react-native run-ios --simulator "iPhone 17 Pro Max"
# navigate to each screen, then:
xcrun simctl io booted screenshot ~/Desktop/01-login.png
xcrun simctl io booted screenshot ~/Desktop/02-home.png
xcrun simctl io booted screenshot ~/Desktop/03-scan.png
xcrun simctl io booted screenshot ~/Desktop/04-materials.png
xcrun simctl io booted screenshot ~/Desktop/05-profile.png
```

Suggested 5 screens to capture (in this order, tells a story): Home/dashboard →
material browsing → visiting card scan → prospect/client management →
profile/digital card. Log in with a real or demo account first so the
screens show populated content, not empty states.

## 9. Demo account for review

Apple's reviewer needs to log in. In App Store Connect's **App Review
Information** section, provide a working mobile number + credentials for
an account with real (or realistic seeded) content visible — an empty
account reads as a broken app to a reviewer who has no context.

## 10. Submit

**Add for Review → Submit to App Review**, only once:
- ✅ The build is attached and finished processing
- ✅ Privacy Policy URL and Support URL are live (test them yourself in an
  incognito window first)
- ✅ App Privacy questionnaire is filled in
- ✅ Demo account credentials are provided
- ✅ The Guideline 3.1.1 payment question above is resolved one way or another

Typical review turnaround: 24–48 hours.
