export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { registerAllJobs } = await import("@/lib/jobs");
    try {
      await registerAllJobs();
    } catch (e) {
      console.error("[instrumentation] pg-boss registration failed:", e);
    }
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
