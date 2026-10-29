"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AiRequest, AiResponse } from "@/lib/ai-schemas";

type ResponseFor<Op extends AiRequest["op"]> = Extract<AiResponse, { op: Op }>;

/**
 * Calls the server AI endpoint for one explicit user action. Supports cancellation;
 * never retries automatically (retries would spend free-tier quota).
 */
export function useAi() {
  const [loading, setLoading] = useState<AiRequest["op"] | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(null);
  }, []);

  const run = useCallback(async <R extends AiRequest>(req: R): Promise<ResponseFor<R["op"]> | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(req.op);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "The AI request failed.", { id: "ai-error" });
        return null;
      }
      return data as ResponseFor<R["op"]>;
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Couldn't reach the server for the AI request.", { id: "ai-error" });
      return null;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(null);
      }
    }
  }, []);

  return { run, loading, cancel };
}
