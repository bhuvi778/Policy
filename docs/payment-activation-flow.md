# Payment and membership activation

## Checkout and return

Membership plans, Buy Now, Upgrade and card booking remain available. Both
Android distribution channels and the shared iOS JavaScript code retain the
purchase routes. The `play` native constant no longer disables purchasing.
Version 49 supersedes the access-only v48 build.

The official react-native-razorpay 3.0.0 SDK opens the backend-created order or
subscription. Its receipt is validated against that checkout and sent to the
existing authenticated verification endpoint. A fresh profile matching the
selected plan then confirms access. A URL or client callback alone does not
prove payment success. Confirmed payments show Payment successful and Continue
returns to Home, or registration onboarding.

On timeout, the screen says confirmation pending and asks the user to check
status before paying again. The minimal receipt and selected-plan context are
stored per account on device, without authentication tokens or customer prefill.
After reopening Membership Plan, Check payment status resumes that receipt
without reopening Razorpay or creating a second order. A fresh profile is read
before repeating verification, since the inspected backend does not provide an
idempotent payment ledger. An unchanged old plan does not prove that a renewal
was committed. Device storage failure does not block submitting verification.

## Inspected backend contract

Read-only source inspection: Policy_bhandar backend commit
9f2049b7735007b6aeb10d66856edba31971da93. This is source evidence, not proof
that the deployed server has the same version.

- POST /api/payments/create-order returns {success, data: order, key}, with
  order.id = order_..., amount in paise and currency. It does not return a Play
  Store URL. The app prioritizes this native checkout over any generic URL.
- POST /api/payments/create-subscription returns the same envelope with a sub_ ID.
- POST /api/payments/verify and verify-subscription receive the matching Razorpay
  reference, payment ID, signature, planId, selectedCategories, selectedAddons and
  couponCode. The backend validates HMAC and writes the user's activePlan and
  planExpiryDate. Subscription verification also sets subscriptionStatus.
- GET /api/auth/me populates activePlan. Admin assignment updates that field and
  expiry. Explicit activePlan=null revokes access even if a stale top-level
  subscriptionStatus says active. A cancelled recurring mandate does not revoke
  an independently paid unexpired activePlan.

A secure hosted URL remains a compatibility fallback if the backend supplies no
native order. WebView intercepts store URLs and intent browser fallbacks; only
supported installed UPI app schemes open externally. Hosted checkout requires
server callback/webhook processing and a fresh authenticated access check.

## Limits requiring server or device verification

No authenticated real payment, money movement or admin mutation was performed.
No phone was connected for this build. The inspected backend has no payment
ledger/webhook and no deployed backend changes were made. Full recovery when the
app is killed before the native receipt callback requires backend payment
reconciliation. Re-verification must be made idempotent on the server for strict
once-only processing; the client fresh-profile check reduces repeated writes
but cannot provide that server guarantee. Verify server-side ownership, amount,
plan and selected permissions against the originally created order before
production charging; this source currently relies primarily on receipt HMAC.

Plans use real API records only. A failed plan refresh retains previously loaded
real records and shows the error; first-load failure does not invent purchasable
plan IDs/prices. Inactive membership refresh runs on focus, foreground return
and every 15 seconds while visible. Personal profile edits cannot block it.

## Build and validation

Rebuild native apps; a JavaScript-only update cannot add the SDK. Android v49
includes all four ABIs and the original upload signature. On macOS run pod
install inside ios, then archive; no iOS native archive was produced on Windows.
Run node --test --test-concurrency=2 tests/*.test.cjs. Fixture tests cover native
receipt verification, cancellation, timeout recovery, account isolation, admin
activation/revocation, old-plan mismatch and purchase-route availability.

Use an authorized test account and a physical device to verify successful UPI
return, cancellation and delayed activation before production rollout. Payment
routing fixes do not establish store billing eligibility or guarantee approval.

Official integration guidance:
https://github.com/razorpay/react-native-razorpay
https://razorpay.com/docs/payments/payment-gateway/callback-url/
