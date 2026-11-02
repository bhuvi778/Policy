# Payment and membership activation

## Distribution modes

Android Play releases default to `POLICYBHANDAR_DISTRIBUTION=play`. Their plans
route is a membership-status screen, and the payment route is not registered.
Directly mounting either old purchase screen also renders only status in this
build. Registration and inactive-account login keep the user on this screen
until the backend confirms access. Menu/profile/training/download messages do
not offer purchases or ask the user to pay elsewhere. No plan catalogue or
payment request is sent by the status screen.

Use `-PPOLICYBHANDAR_DISTRIBUTION=direct` for a separate Android distribution that
retains the Razorpay flow described below. The current release scope is Android
only; no new iOS archive or submission was performed.

Direct checkout uses the official `react-native-razorpay` native SDK (3.0.0).
The server creates the order/subscription; the app sends the returned receipt to
the existing authenticated verification endpoint. Only a fresh authenticated
profile can confirm membership access. A success URL or a native callback alone
does not unlock a plan.

## Server contract

- `POST /api/payments/create-order`: return a public Razorpay key and an order
  with `id: "order_..."`, amount in minor units and currency. A nested `order`
  record is supported. The app sends the selected plan, categories and addons.
- `POST /api/payments/create-subscription`: return the key and `id: "sub_..."`
  or `subscription_id`. A nested `subscription` record is supported.
- Existing verification routes `/api/payments/verify` and
  `/api/payments/verify-subscription` must validate the signature and match the
  order/subscription to the authenticated user and intended plan on the server.
  Acknowledge successful verification only after persisting the payment result.
- `GET /api/auth/me` must return the current admin-assigned or paid entitlement.
  Supported shapes include `activePlan`, active subscription/membership records,
  and explicit active flags and expiry dates. A bare selected `planId` without
  activation evidence does not unlock membership. Expired, pending or revoked
  subscriptions do not unlock access through stale flags.

If a secure hosted payment URL is the only checkout information returned, it
still opens in the payment WebView. Store redirects and intent fallback URLs
are intercepted. Only supported installed UPI app schemes can open externally.
A return to the app triggers an authenticated membership check. The hosted
provider/backend must process its callback/webhook; the app cannot manufacture
missing server verification.

## Activation refresh

On the plans screen, an inactive account is checked on focus, foreground return
and every 15 seconds while the screen remains visible. Manual refresh forces a
fresh read. Payment confirmation polls a bounded number of fresh reads. Pending
personal profile edits no longer prevent membership reads, and older profile
responses cannot overwrite a newer read. Waiting users continue to Home (or
registration onboarding) after confirmed activation.

Verified payment with delayed activation remains pending and offers status
checking rather than claiming success or asking the user to pay again.

## Building and validating

This adds native code; old APKs/IPAs and a JavaScript-only update do not include
the SDK. Install npm dependencies and rebuild Android. On macOS run `pod install`
inside `ios` before archiving the iOS app; CocoaPods must update `Podfile.lock`.
The lockfile was not synthesized on Windows.

Run `node --test tests/*.test.cjs`. The payment suite covers matching receipts,
server verification ordering, cancellations, delayed activation, store fallbacks,
admin entitlement wrappers, stale reads and pending personal edits. These use
fixtures; they are not real charges or live admin-panel mutations.

Before a store release, use an authorized Razorpay test account to exercise UPI
return, successful verification, failure/cancellation and delayed activation on
a device. Also assign a plan in the real admin panel and verify `/api/auth/me`
returns it. No authenticated backend account, connected phone or macOS iOS build
was available during the implementation checks.

Razorpay's integration guidance recommends the native SDK for mobile checkout:
https://razorpay.com/docs/payments/payment-gateway/callback-url/

Payment routing fixes do not by themselves establish store billing eligibility.
The existing App Store submission notes cover the separate digital-subscription
purchase requirements.
