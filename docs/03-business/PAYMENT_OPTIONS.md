# Payment options

## India-first checkout

Razorpay or another Indian payment gateway may provide UPI/cards/net banking. Gateway pricing, GST on gateway fees, settlement timing, KYC, refund fees, and international-card support must be confirmed on the provider account before implementation.

## International checkout

Options:

1. direct payment processor, with Skribly handling customer tax and compliance
2. Merchant of Record, which charges more but handles many customer-facing indirect-tax obligations
3. platform commerce through Microsoft or Apple, with store commission and platform rules

Low-price products are sensitive to fixed per-transaction fees. Model ₹499, ₹999, US$9.99, and US$19.99 before selecting providers.

## Security

- never store card or UPI credentials
- verify payment server-side
- licence issuance must be idempotent
- webhooks require signature verification and replay protection
- refunds must revoke or update licence state transparently
