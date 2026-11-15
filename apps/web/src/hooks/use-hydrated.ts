"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
// Server and the first hydration render match; browser-dependent values render afterwards.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
