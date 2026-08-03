// hooks/use-signed-url.ts
"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

import { withBearerToken } from "@/lib/fetch-auth";

export function useSignedUrl(fileId: string, enabled = true) {
  const { data: session } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (!enabled) {
        setLoading(false);
        setUrl(null);
        return;
      }

      setLoading(true);
    });

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    fetch(
      `${process.env.NEXT_PUBLIC_API_HOST}/api/storage/download?fileId=${encodeURIComponent(fileId)}`,
      withBearerToken(undefined, session?.accessToken),
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setUrl(d.downloadUrl ?? d.url ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, enabled, session?.accessToken]);

  return { url, loading };
}