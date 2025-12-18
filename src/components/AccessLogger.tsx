"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Client-side page navigation logger.
 * Calls /api/log-access on route changes so page visits are reliably persisted
 * (middleware-based server-to-server logging may not fire for page navigations in some deployments).
 */
export default function AccessLogger() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    // Fire-and-forget.
    // Keep payload minimal; server resolves IP and userId from request/cookies.
    void fetch("/api/log-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      credentials: "include",
      cache: "no-store",
    }).catch(() => {
      // ignore
    });
  }, [pathname]);

  return null;
}

