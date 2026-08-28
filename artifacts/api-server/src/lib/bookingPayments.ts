import { pool } from "@workspace/db";

export const VALID_PAYMENT_STATUSES = ["unpaid", "paid"] as const;

export type PaymentStatusValue = (typeof VALID_PAYMENT_STATUSES)[number];

let bookingPaymentColumnsPromise: Promise<void> | null = null;

export const ensureBookingPaymentColumns = () => {
  bookingPaymentColumnsPromise ??= pool
    .query(`
      alter table public.bookings
        add column if not exists payment_status text not null default 'unpaid',
        add column if not exists paid_at timestamp
    `)
    .then(() => undefined);
  return bookingPaymentColumnsPromise;
};

export const isPaymentStatus = (value: unknown): value is PaymentStatusValue =>
  typeof value === "string" && (VALID_PAYMENT_STATUSES as readonly string[]).includes(value);

export const normalizePaymentStatus = (value: unknown): PaymentStatusValue =>
  value === "paid" || value === "pagato" || value === true ? "paid" : "unpaid";
