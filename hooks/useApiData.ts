"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { withBearerToken } from "@/lib/fetch-auth";

export interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => void;
}

export function useApiData<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): UseApiDataResult<T> {
  const { data: session } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const isActiveRef = useRef(true);

  const stringParams: Record<string, string> = Object.fromEntries(
    Object.entries(params).map(([key, val]) => [key, String(val)])
  );

  const query = new URLSearchParams(stringParams).toString();
  const url = `${endpoint}${query ? `?${query}` : ""}`;

  const doFetch = useCallback(async () => {
    if (!isActiveRef.current) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, withBearerToken(undefined, session?.accessToken));
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const json = await res.json();
      if (!isActiveRef.current) return;

      setData(json?.value ?? json);
      setLastFetched(new Date());
    } catch (e: unknown) {
      if (!isActiveRef.current) return;

      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
      }
    }
  }, [session, url]);

  useEffect(() => {
    isActiveRef.current = true;

    const timeoutId = window.setTimeout(() => {
      void doFetch();
    }, 0);

    return () => {
      isActiveRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [doFetch]);

  return { data, loading, error, lastFetched, refresh: () => { void doFetch(); } };
}