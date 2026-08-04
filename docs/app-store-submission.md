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
```
https://www.policybhandar.com/
```
There's no dedicated `/contact-us` route (it redirects to home) — the
homepage itself has a **Support & FAQs** section, a "Contact Support"
button, and a contact form, which satisfies Apple's requirement that the
Support URL let a user actually get help. If you'd rather have a URL that
scrolls straight to that section, use `https://www.policybhandar.com/#faq`
(confirmed working).

### Marketing URL (optional)
```
https://www.policybhandar.com/
```

### Privacy Policy URL (required) — verified live
```
https://www.policybhandar.com/privacy-policy
```
Confirmed this is already live and real (not a placeholder) — it explicitly
covers the "Policy Bhandar iOS App and Website" and mentions Apple's App
Tracking Transparency framework. One thing to reconcile before submitting:
this app's current codebase has no analytics/ad-tracking SDK, so the ATT
mention is just generic boilerplate — don't let it push you into answering
the App Privacy questionnaire's "used to track you" questions as "Yes"
when nothing in the app actually does IDFA-based tracking today (see §6).

### Terms of Use / EULA URL — verified live, already Apple-formatted
```
https://www.policybhandar.com/terms-and-conditions
```
This page is already written as an Apple Standard EULA (explicitly names
Apple as a third-party beneficiary, disclaims Apple's warranty/support
obligations, etc.) — someone clearly prepared this with iOS submission in
mind already. You can paste this into App Store Connect's **App
Information → License Agreement → Custom License Agreement** field, and/or
just link it from your description.

### Note: Refund Policy link is currently broken
The footer's "Refund Policy" link (`href="#"`) doesn't go anywhere yet —
not required by Apple as a distinct field, but worth fixing on the
website since the footer promises it. Not a submission blocker.

### (Fallback) Self-hosted legal pages
`legal/privacy-policy.html`, `terms.html`, `support.html` were drafted
earlier in this repo as a backup, in case `policybhandar.com` URLs above
aren't your final answer — they're no longer needed now that the real
site has better versions live, but they're harmless to leave in the repo.

## 6. App Privacy questionnaire — concrete answers

### Your team lead's ask: fewer items linked to identity

Went back through the code specifically looking for what's genuinely
avoidable vs. what's load-bearing for having an account at all. Three real,
code-verified reductions from the original draft:

1. **Payment Info → declare "Not Collected."** `PaymentWebViewScreen.js`
   loads Razorpay's own `checkout.js` inside the WebView — the card/bank
   details never pass through PolicyBhandar's app code or backend. The app
   only ever receives back `razorpay_payment_id`, `razorpay_subscription_id`,
   `razorpay_signature` — opaque transaction reference strings, not the
   financial account data Apple's "Payment Info" category actually means
   (card numbers, bank account numbers). Since PolicyBhandar's own app/servers
   never touch that data, it's accurate — not a stretch — to not declare it.
2. **Photos → narrowed to "profile photo" only, scanned card photos dropped.**
   Checked `DataEntryScreen.js`'s `buildEntry()` (the object actually sent
   to `saveClient`/the backend when an advisor saves a scanned contact): it
   sends `name, mobile, dob, memberType, policyNo, company, plan, premium,
   dueDate` — **the card photo itself is never included.** The OCR crop/scan
   runs entirely on-device (Vision on iOS / ML Kit on Android) and the photo
   only lives in a local temp file for the on-screen preview. Apple's privacy
   label only counts data that's actually collected off-device — since this
   photo never leaves the device, it doesn't need to be declared at all. The
   profile photo (`MyProfileScreen.js`) is genuinely uploaded, so that one
   stays.
3. **Physical Address → worth reconsidering entirely.** What's actually
   collected is a bare 6-digit PIN/postal code (`RegisterScreen.js`'s "Area
   Pin Code" field), not a mailing address. Apple's "Physical Address"
   category is specifically about mailing addresses — a standalone postal
   code used only for regional routing (branch/franchise assignment, per
   `appData.js`'s `getAssignedFranchise`/`getAssignedRep`) is common practice
   to leave undeclared under that category. Flagging this as a judgment call
   for you/your team lead rather than deciding it myself — it's defensible
   either way, but leaving it out is standard for bare postal codes.

What's **left and can't be reduced further** without removing features:
Name, Phone Number, Email, User ID (auth token) — these are the account
system itself, inherent to any app with login. Other User Content
(client/prospect records) — inherent to the CRM feature; it's tied to the
advisor's account because the advisor owns those records. There's no way
to keep those features and not have this data linked to the account.

### Updated table

| Data type | Collected? | Linked to identity? | Purpose |
|---|---|---|---|
| Name | Yes | Yes | App Functionality, Account creation |
| Phone Number | Yes | Yes | App Functionality (login is mobile-number based), Account creation |
| Email Address | Yes | Yes | App Functionality, Customer Support |
| Physical Address | **No** *(bare PIN code, not a mailing address — see above)* | — | — |
| Photos | Yes — **profile photo only** | Yes | App Functionality |
| Other User Content | Yes (client/prospect records advisors enter) | Yes | App Functionality |
| User ID | Yes (auth token) | Yes | App Functionality |
| Payment Info | **No** *(Razorpay handles it directly — see above)* | — | — |
| Precise/Coarse Location | No | — | — |
| Contacts (device address book) | No — app does not read the device contact list | — | — |
| Analytics/Usage Data | No SDK detected — re-check if you add one later | — | — |
| Diagnostics/Crash Data | No SDK detected — re-check if you add one later | — | — |

That's 5 linked-to-identity rows instead of 8 — Name/Phone/Email/User
ID/Other User Content, all of them genuinely required for an authenticated
CRM app to function. If your team lead wants it lower than that, the only
further lever is removing a feature (e.g. not letting advisors store client
records at all), not a privacy-label wording change.

Declare "Data Used to Track You" = **No** for all of the above — nothing
in this codebase does cross-app/cross-site ad tracking.

Note: the live `policybhandar.com/privacy-policy` text mentions collecting
"Usage Data (pages visited, features used, time spent)" — the app doesn't
currently do this (no analytics SDK). Either it's aspirational boilerplate
you can leave as-is (Apple checks the App Privacy nutrition label against
actual behavior, not every sentence of the policy prose), or add basic
usage analytics later to match it — your call, not a submission blocker
either way.

## 7. Archive & upload

See `docs/versioning-releases.md` for the full walkthrough:
bump `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` → select "Any iOS
Device (arm64)" → **Product → Archive** → Organizer → **Distribute App →
App Store Connect → Upload**.

## 8. App icon — done

The iOS app had no icon at all (the asset catalog slots existed but no
image files were wired in — it would have shown a blank icon). Fixed:
`ios/PolicyBhandar/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png` is
now a crisp 1024×1024, RGB (no alpha — Apple rejects icons with
transparency), redrawn at full resolution from the same design as the
Android launcher icon (red `#BF392B` background, white circle, "PB"
monogram) rather than upscaled from Android's small PNG, so it stays sharp
at every size. Wired up using Xcode's modern "single size" App Icon format
— `Contents.json` now just points at that one 1024 image and Xcode derives
every smaller size automatically at build time; no need to hand-generate
the old 9-file icon set.

Check it yourself: in Simulator, `Cmd+Shift+H` to go to the home screen
and look for the PolicyBhandar icon (I can't script this myself — Simulator
keystroke automation needs a macOS Accessibility permission I'm not going
to request on your behalf).

If you'd rather use the full marketing-lockup logo
(`src/assets/images/policybhandar_logo.png` — wings/flame/book emblem with
"PolicyBhandaar" text underneath) instead of the "PB" monogram, say so —
but note Apple's Human Interface Guidelines specifically discourage text in
app icons because it becomes illegible at small sizes (the 60pt icon on a
phone home screen, or the ~20pt icon in Settings/Spotlight) — the monogram
is the safer, more standard choice, which is presumably why the Android
launcher already uses it instead of the full lockup.

## 9. Screenshots

### Required sizes (as of this writing)
- **6.9" display** (iPhone 17 Pro Max / 16 Pro Max class) — **required**, 1320×2868px portrait
- **iPad 13" display** — only required if you keep iPad support. This
  project's `Info.plist` currently declares
  `UISupportedInterfaceOrientations~ipad`, meaning it's flagged as
  iPad-compatible — either shoot iPad screenshots too, or remove that key
  if you don't actually want to support/test iPad.
- Apple auto-scales your largest uploaded size down to cover older/smaller
  device families in the listing — you don't need to shoot every size by
  hand, just the largest required one per family.
- Format: PNG or JPEG, RGB (no alpha channel), exact pixel dimensions
  above, portrait orientation, up to 10 images per size.

### Before you shoot: clean up what's visible

1. **Log in with a populated demo account first.** Empty states
   (no materials, no clients, no due dates) read as a broken/unfinished
   app to anyone browsing the App Store. Use the same demo account you'll
   give App Review (§10).
2. **Set a clean status bar.** Simulator shows your Mac's real time/battery
   by default, which looks inconsistent across screenshots taken minutes
   apart. Override it to Apple's standard marketing status bar before
   capturing:
   ```bash
   xcrun simctl status_bar booted override \
     --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
     --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
   ```
   `9:41` is Apple's own marketing-screenshot convention (it's the time in
   basically every Apple keynote screenshot) — using it isn't required, but
   it signals you know what you're doing and keeps every screenshot's
   status bar identical.
3. **Don't ship the dev banner.** Every screenshot taken so far in this
   session shows a yellow "Open debugger to view warnings" banner at the
   bottom — that's Metro's debug-mode LogBox indicator and must not appear
   in App Store screenshots. Either dismiss it (tap the ✕ before each
   screenshot) or, better, build in **Release** configuration for the
   screenshot pass so dev-only UI doesn't render at all:
   ```bash
   npx react-native run-ios --simulator "iPhone 17 Pro Max" --mode Release
   ```

### Capture

```bash
xcrun simctl boot "iPhone 17 Pro Max"
npx react-native run-ios --simulator "iPhone 17 Pro Max" --mode Release
xcrun simctl status_bar booted override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100

# log in, navigate to each screen, then:
xcrun simctl io booted screenshot ~/Desktop/01-home.png
xcrun simctl io booted screenshot ~/Desktop/02-materials.png
xcrun simctl io booted screenshot ~/Desktop/03-scan.png
xcrun simctl io booted screenshot ~/Desktop/04-clients.png
xcrun simctl io booted screenshot ~/Desktop/05-profile.png
```

Suggested 5 screens (in this order, tells a story a browsing user can
follow at a glance): Home/dashboard → material browsing → visiting-card
scan → prospect/client management → profile/digital card.

### Optional polish
Plain device screenshots (exactly what the commands above produce) are
fully accepted by Apple and are literally what Apple's own guidelines
recommend leading with — you do **not** need device-frame mockups or
marketing text overlays. If you want them anyway for a more "designed"
look, that's a separate design pass (e.g. Figma/Canva templates) — say the
word and I can help with layout, but it's not required for submission.

## 10. Demo account for review

Apple's reviewer needs to log in. In App Store Connect's **App Review
Information** section, provide a working mobile number + credentials for
an account with real (or realistic seeded) content visible — an empty
account reads as a broken app to a reviewer who has no context.

## 11. Submit

**Add for Review → Submit to App Review**, only once:
- ✅ The build is attached and finished processing
- ✅ Privacy Policy URL and Support URL are live (test them yourself in an
  incognito window first)
- ✅ App Privacy questionnaire is filled in
- ✅ Demo account credentials are provided
- ✅ The Guideline 3.1.1 payment question above is resolved one way or another

Typical review turnaround: 24–48 hours.
