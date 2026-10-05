# iOS App Review: build 2 (Oct 2026)

A record of the first App Store review result, the decisions made in response, what changed in build 2, and what is left to do. The branch is `ios/app-review-build-2`.

## 1. What Apple said about build 1

Version 1.0 (build 1) came back with **Guideline 2.1 – Information Needed**. This is not a rejection for a bug. Apple paused the review and asked for the following, to be sent through App Store Connect:

1. A screen recording made on a physical iPhone running the latest iOS. It must start at app launch and show:
   - registration, login and **account deletion**
   - **paid content, purchase or subscription flows**
   - any user-generated content and its reporting and blocking
   - every permission prompt
2. The device models and iOS versions the app was tested on.
3. What the app does, who it is for, and the value it gives them.
4. Setup steps, including login credentials and any sample files.
5. External services the app relies on.
6. Any regional differences.
7. Documents for regulated industries or third-party material.

Apple also asked that this information go into **App Review Information → Notes** for future submissions.

## 2. Decisions

| Topic | Decision | Who decided |
|---|---|---|
| Razorpay payment in registration step 4 (`Subscription` screen after sign-up) | **Keep it on iOS.** The team accepts the risk of a 3.1.1 rejection and will add Apple in-app purchase later. | Product owner |
| Other ways into the plans screen | **Hide them on iOS only.** Android is unchanged. | Product owner |
| Account deletion | Call the real backend endpoint, which already existed. | Agreed |
| Extra fixes in this build | Turn off VisionCamera location, remove camera-kit, check every permission. | Product owner |
| Rate Us (Play Store link on iOS) | **Not changed in this build.** | Product owner (not selected) |
| iOS downloads open in Safari | **Not changed in this build.** | Product owner (not selected) |
| Branch | All work on `ios/app-review-build-2`, not `main`. | Product owner |

If Apple rejects under **3.1.1**, the next step is to hide the registration paywall on iOS too: `App.js:97`, `LoginScreen.js` `getPostLoginRoute` and `RegisterScreen.js:253`. Payments that come back to iOS later must use Apple in-app purchase (StoreKit), not Razorpay.

## 3. What changed in build 2

### Hidden on iOS only

The flag is `SHOW_PLAN_ENTRY_POINTS` in `src/utils/platform.js`. It is `false` on iOS.

| Entry point | File | iOS now shows |
|---|---|---|
| Drawer item "Membership Plan" | `src/components/DrawerSidebar.js` | The item is removed |
| Search quick-link "Subscription Plans" | `src/screens/SearchScreen.js` | The link is removed |
| Profile "Manage Plan" / "Choose Plan" button | `src/screens/MyProfileScreen.js` | The button is removed; the read-only "Membership Status" card stays |
| Training "Upgrade" button on locked cards | `src/screens/TrainingScreen.js` | The button is removed; the lock icon and "Locked by current plan" text stay |

### Not hidden (on purpose)

- The starting screen still routes a user with no plan to `Subscription` (`App.js:97`).
- After login, a user with no plan still goes to `Subscription` (`LoginScreen.js:73-74`).
- After registration, step 4 still goes to `Subscription` (`RegisterScreen.js:253`).
- `SubscriptionPlansScreen` (with its WhatsApp "plan unavailable" fallback) and `PaymentWebViewScreen` (Razorpay checkout) are unchanged.
- The download-limit messages in `src/services/downloadQuota.js` ("activate a membership plan", "upgrade your plan") are unchanged.

### Other changes

- **Account deletion:** "Delete My Account" now calls `DELETE /api/auth/delete-account` (`deleteAccount` in `src/services/api.js`). The confirmation reads "This will permanently delete your account and profile. This cannot be undone." On success the app logs out and goes back to Login. On failure it shows an error and the user stays logged in. Before this change, the button only showed a fake "Request Sent" message.
- **Onboarding:** the "Storage Permission" screen is skipped on iOS. It only ever called `PermissionsAndroid`, so on iOS it was a fake permission screen.
- **`Info.plist`:** added `NSPhotoLibraryAddUsageDescription`. Without it, tapping "Save Image" in the iOS share sheet crashes the app.
- **`ios/Podfile`:** added `$VCEnableLocation = false`. The binary no longer contains `requestWhenInUseAuthorization` or `startUpdatingLocation`, which fixes the ITMS-90683 warning about missing location text.
- **Removed** the unused `react-native-camera-kit`.
- **Version:** `CURRENT_PROJECT_VERSION` is 2. `MARKETING_VERSION` stays 1.0.

### Permissions in build 2

| Permission | Where it's used | Purpose text |
|---|---|---|
| Camera | Visiting-card scan (VisionCamera, no audio) | `NSCameraUsageDescription` (already present) |
| Add to Photos | Share sheet "Save Image" | `NSPhotoLibraryAddUsageDescription` (new) |
| Photo library read | Profile photo, through `PHPickerViewController` | Not needed: the system picker needs no permission |
| Location, microphone, contacts, tracking | Not used | None |

## 4. Known gaps, not fixed yet

- **Backend `deleteAccount`** (`Policy_bhandar/backend/controllers/authController.js:392`) deletes only the User document. It does **not** cancel an active Razorpay subscription and does **not** delete the user's uploaded files in Cloudflare R2.
- `RateUsScreen.js` still shows "Rate on Play Store" on iOS (Guideline 2.3.10 risk).
- `src/services/downloads.js` still opens files in Safari on iOS. The ported native `PolicyBhandarDownloader` is never called on iOS, so `docs/ios-native-modules.md` is wrong on this point.
- `RateUsScreen.js:87` shows a hard-coded "Version 10.6.9".

## 5. Backend facts (from `../Policy_bhandar`)

- **Repo:** `github.com/prashant272/Policy_bhandar`, cloned at `../Policy_bhandar`.
- **Login** uses email or mobile plus a **password**. A one-time code is sent only at signup and for "forgot password", by email and WhatsApp.
- There is **no admin approval step for users.** Access to content depends on the user's `activePlan` or `unlockedCategories`.
- `protect` middleware returns 401 once a user is deleted, so a deleted account's old token stops working.

## 6. External services (answer to question 5)

| Service | Purpose |
|---|---|
| AWS | Hosts the Node.js and Express backend (`api2.primeimpact.in`) |
| MongoDB | Main database. Confirm whether it is MongoDB Atlas or self-hosted |
| Cloudflare R2 | Stores images, videos and PDFs (accessed through the AWS S3 SDK) |
| Brevo (SMTP) | Sends email one-time codes |
| aoc-portal.com WhatsApp API | Sends WhatsApp one-time codes |
| Razorpay | Plan payments after registration |
| YouTube | Plays training videos |
| Vercel | Hosts the web frontend and the payment page |

Google Gemini and Tesseract are in the backend `package.json` but no code uses them, so don't list them. **Don't** claim "no third-party services" or "no payment processor": the Razorpay flow is still in build 2.

## 7. Reply to Apple vs. submitting a new build

There's no need to create a new app or a new version. Keep **version 1.0** and do this:

1. Archive and upload **build 2** from Xcode, then wait for it to finish processing.
2. Install build 2 through TestFlight on a physical iPhone running the latest iOS, and test it (see §8).
3. Record the video **using build 2**.
4. Under App Store Connect → the app → **1.0** → **App Review Information**:
   - Fill in the demo account: email or mobile, plus password, with plan and content unlocked.
   - Paste the answers to the 7 questions into **Notes**.
   - Attach the video.
5. In the same 1.0 version, **replace build 1 with build 2** in the Build section.
6. **Reply to Apple's message** in App Store Connect (App Review) with the same 7 answers and the video. Apple explicitly asked for a reply, so a silent resubmit isn't enough.
7. Click **Resubmit to App Review**, or Add for Review → Submit.

## 8. Video checklist (build 2, physical iPhone)

1. Launch the app from the home screen.
2. Register a new account, through the step 4 plans screen, which shows the Razorpay purchase flow.
3. Log in with the demo account.
4. Browse Home, Training, posters and videos, and do a download or share.
5. Scan a visiting card. The **camera permission prompt** appears.
6. Share an image and tap **Save Image**. The **Photos permission prompt** appears.
7. Go to My Profile → **Delete My Account** (with a throwaway account), confirm, and show that it returns to Login.
8. Show that logging back in with the deleted account fails.

## 9. Build notes

- **Steps:** clean → `npm ci` → `cd ios && pod install` → open `ios/PolicyBhandar.xcworkspace` → Product → Archive.
- **Gotcha:** the project used to live at `~/Downloads/Projects/Policy`. If a Release build fails with `hermesc: No such file or directory` pointing at the old path, delete `ios/Pods/Local Podspecs/hermes-engine.podspec.json` (or all of `ios/Pods`) and run `pod install` again.
