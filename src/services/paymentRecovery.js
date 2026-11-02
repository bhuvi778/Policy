import Storage from './storage';

export const paymentOwner = user => String(user?._id || user?.id || user?.userId || user?.mobile || user?.email || '').trim().toLowerCase();
const keyFor = user => `@policybhandar_payment_pending_v1:${encodeURIComponent(paymentOwner(user))}`;
const reference = checkout => checkout?.data?.id || checkout?.data?.order_id || checkout?.data?.subscription_id || '';

export const readPendingPayment = async user => {
  if (!paymentOwner(user)) return null;
  try {
    const saved = JSON.parse(await Storage.getItem(keyFor(user)) || 'null');
    return saved?.owner === paymentOwner(user) && reference(saved.checkout) && saved.receipt ? saved : null;
  } catch (_) { return null; }
};

export const savePendingPayment = async (user, checkout, receipt, verified = false) => {
  if (!paymentOwner(user) || !reference(checkout)) return;
  const { mode, key, data, planId, planName, selectedCategories, selectedAddons, couponCode, previousPlanId, previousValidTill } = checkout;
  // Keep only verification context; do not save customer prefill or authentication tokens.
  const pending = { owner: paymentOwner(user), savedAt: Date.now(), verified,
    checkout: { mode, key, data: { id: reference(checkout), amount: data?.amount, currency: data?.currency }, planId, planName, selectedCategories, selectedAddons, couponCode, previousPlanId, previousValidTill },
    receipt: { razorpay_payment_id: receipt.razorpay_payment_id, razorpay_order_id: receipt.razorpay_order_id,
      razorpay_subscription_id: receipt.razorpay_subscription_id, razorpay_signature: receipt.razorpay_signature },
  };
  await Storage.setItemDurable(keyFor(user), JSON.stringify(pending));
};

export const clearPendingPayment = async (user, checkout) => {
  const saved = await readPendingPayment(user);
  if (saved && reference(saved.checkout) === reference(checkout)) await Storage.removeItem(keyFor(user));
};
