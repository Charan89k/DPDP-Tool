/**
 * TLI — Razorpay gateway (server only).
 *
 * Keys come from the environment and never leave the server, except the public key id that
 * Razorpay Checkout needs in the browser. Test or live mode follows the key id prefix
 * (rzp_test_ / rzp_live_). API calls use the official `razorpay` SDK; signatures are checked here
 * with constant-time HMAC-SHA256 comparisons as documented by Razorpay.
 */

import crypto from "node:crypto";
import Razorpay from "razorpay";

type Env = Record<string, string | undefined>;

export type PaymentMode = "test" | "live";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  mode: PaymentMode;
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

/** Returns the Razorpay configuration, or null when payments are not configured on this server. */
export function getRazorpayConfig(env: Env = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  const mode: PaymentMode | null = keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : null;
  if (!mode) throw new PaymentConfigurationError("RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_.");
  return { keyId, keySecret, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() || null, mode };
}

export function requireRazorpayConfig(env: Env = process.env): RazorpayConfig {
  const config = getRazorpayConfig(env);
  if (!config) throw new PaymentConfigurationError("Online payment is not configured on this server.");
  return config;
}

function hmacHex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/** Checkout handler signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC-SHA256 of the exact raw request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}

/** The subset of Razorpay's order and payment entities this application relies on. */
export interface GatewayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface GatewayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string; // created | authorized | captured | refunded | failed
  amount_refunded?: number;
  error_description?: string | null;
}

export interface PaymentGateway {
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<GatewayOrder>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  fetchOrderPayments(orderId: string): Promise<GatewayPayment[]>;
}

function sdkGateway(config: RazorpayConfig): PaymentGateway {
  const client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  return {
    async createOrder(input) {
      return (await client.orders.create(input)) as unknown as GatewayOrder;
    },
    async fetchPayment(paymentId) {
      return (await client.payments.fetch(paymentId)) as unknown as GatewayPayment;
    },
    async fetchOrderPayments(orderId) {
      const result = (await client.orders.fetchPayments(orderId)) as unknown as { items?: GatewayPayment[] };
      return result.items ?? [];
    },
  };
}

let gatewayOverride: PaymentGateway | null = null;

/** Automated tests replace the network gateway with a stub; never used by application code. */
export function setPaymentGatewayForTests(gateway: PaymentGateway | null): void {
  gatewayOverride = gateway;
}

export function getPaymentGateway(env: Env = process.env): PaymentGateway {
  return gatewayOverride ?? sdkGateway(requireRazorpayConfig(env));
}
