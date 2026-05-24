// ─── Next.js Instrumentation — Process-level error guards ───
// This file runs ONCE when the Next.js server process starts.
// We register global error handlers to prevent unhandled errors
// from crashing the entire process.

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ─── Guard 1: uncaughtException ───
    // An uncaught exception in a route handler or middleware would normally
    // crash the Node.js process. We catch it here, log it, and keep the
    // server alive. The individual request still fails, but the server
    // continues serving other requests.
    process.on('uncaughtException', (error) => {
      // PrismaClientInitializationError = bad DB connection config
      // These should NOT crash the server — just log and continue.
      const errorName = error.constructor?.name || 'Error';
      const isPrismaInit = errorName === 'PrismaClientInitializationError';
      const isPrismaValidation = errorName === 'PrismaClientValidationError';

      if (isPrismaInit || isPrismaValidation) {
        console.error(
          `[instrumentation] ⚠ Prisma error (non-fatal): ${error.message}\n` +
          `  DB-dependent routes will fail until DATABASE_URL is fixed.\n` +
          `  Server process stays alive for static/client-side pages.`
        );
        // DO NOT re-throw — keep the server alive
        return;
      }

      // For truly unexpected errors, log but still don't crash
      // (the double-fork guardian will restart if the process becomes unresponsive)
      console.error(
        `[instrumentation] ⚠ Uncaught exception (non-fatal):\n` +
        `  ${error.message}\n` +
        `  Stack: ${error.stack?.split('\n').slice(0, 3).join('\n  ')}`
      );
      // DO NOT re-throw — keep the server alive
    });

    // ─── Guard 2: unhandledRejection ───
    // An unhandled Promise rejection (e.g., from an async route handler)
    // would crash the process in Node.js 15+. We catch it here.
    process.on('unhandledRejection', (reason) => {
      const reasonStr = reason instanceof Error
        ? `${reason.constructor?.name}: ${reason.message}`
        : String(reason);

      // Prisma initialization errors are expected when DB is misconfigured
      if (reasonStr.includes('PrismaClient') || reasonStr.includes('datasource')) {
        console.error(
          `[instrumentation] ⚠ Unhandled Prisma rejection (non-fatal): ${reasonStr}\n` +
          `  Server process stays alive.`
        );
        return;
      }

      console.error(
        `[instrumentation] ⚠ Unhandled rejection (non-fatal): ${reasonStr}\n` +
        `  Server process stays alive.`
      );
      // DO NOT exit — keep the server alive
    });

    console.log('[instrumentation] ✓ Process error guards registered (double-fork resilient mode)');
  }
}
