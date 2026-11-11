export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db } = await import("./server/db");
    const clean = async () => {
      try {
        await db.importPreview.updateMany({
          where: { expiresAt: { lt: new Date() }, original: { not: null } },
          data: { original: null },
        });
      } catch {
        console.error(
          JSON.stringify({ operation: "preview-cleanup", status: "failed" }),
        );
      }
    };
    // Expired previews are denied immediately; private source text is erased at
    // startup and within five minutes while the process is running.
    void clean();
    setInterval(() => {
      void clean();
    }, 300000).unref();
  }
}
