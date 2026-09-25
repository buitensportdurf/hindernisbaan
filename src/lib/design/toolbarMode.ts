import type { DrawTool } from './drawTool';

export type ToolbarMode = 'create' | 'selected';

/** Drawing keeps the create toolbar; otherwise a selection switches to selected actions. */
export function toolbarMode(tool: DrawTool, selectedId: string | null): ToolbarMode {
  if (tool !== null) return 'create';
  if (selectedId !== null) return 'selected';
  return 'create';
}
