const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** ₹1,23,456 — for server messages (toasts). */
export const money = (rupees: number) => inr.format(rupees);
