"use client";

import type { WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";

// Settings saved per block instance. Removing the block removes only these.
export function useBlockConfig<T extends Record<string, unknown>>(block: WorkspaceBlock, defaults: T) {
  const { updateBlockConfig } = useWorkspaceData();
  const config = { ...defaults, ...block.config } as T;
  const setConfig = (patch: Partial<T>) => updateBlockConfig(block.id, patch);
  return [config, setConfig] as const;
}
