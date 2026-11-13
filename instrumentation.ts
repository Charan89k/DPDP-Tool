/**
 * TLI — Server start-up hook (Next.js instrumentation). Starts the notification scheduler that
 * sends consultation reminders and retries failed emails. Disable with TLI_NOTIFICATION_SCHEDULER=off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.TLI_NOTIFICATION_SCHEDULER === "off") return;
  const { startNotificationScheduler } = await import("./lib/notifications/dispatch");
  startNotificationScheduler();
}
