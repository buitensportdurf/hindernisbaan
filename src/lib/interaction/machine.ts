export type DrawTool = 'point' | 'landmark' | 'line' | 'polygon' | 'rectangle' | 'remove' | null;

export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'selected'; id: string }
  | { kind: 'details'; id: string }
  | { kind: 'drawing'; tool: Exclude<DrawTool, null> };

export type InteractionConfig = {
  openDetailsOn: 'click' | 'dblclick';
};

export type InteractionEvent =
  | { type: 'featureClick'; id: string }
  | { type: 'featureDoubleClick'; id: string }
  | { type: 'backgroundClick' }
  | { type: 'escape' }
  | { type: 'closeDetails' }
  | { type: 'setTool'; tool: DrawTool }
  | { type: 'created'; id: string; valid: boolean }
  | { type: 'deleted'; id: string };

export function transition(
  state: InteractionState,
  event: InteractionEvent,
  config: InteractionConfig
): InteractionState {
  switch (event.type) {
    case 'featureClick': {
      if (state.kind === 'details' || state.kind === 'drawing') return state;
      if (config.openDetailsOn === 'click') return { kind: 'details', id: event.id };
      return { kind: 'selected', id: event.id };
    }

    case 'featureDoubleClick': {
      if (config.openDetailsOn !== 'dblclick') return state;
      if (state.kind !== 'idle' && state.kind !== 'selected') return state;
      return { kind: 'details', id: event.id };
    }

    case 'backgroundClick': {
      if (state.kind === 'selected') return { kind: 'idle' };
      return state;
    }

    case 'escape': {
      if (state.kind === 'selected' || state.kind === 'drawing') return { kind: 'idle' };
      return state;
    }

    case 'closeDetails': {
      if (state.kind !== 'details') return state;
      // View mode has no selected-but-closed state — dismiss goes straight to idle.
      if (config.openDetailsOn === 'click') return { kind: 'idle' };
      return { kind: 'selected', id: state.id };
    }

    case 'setTool': {
      if (event.tool === null) {
        if (state.kind === 'drawing') return { kind: 'idle' };
        return state;
      }
      return { kind: 'drawing', tool: event.tool };
    }

    case 'created': {
      if (state.kind !== 'drawing') return state;
      // The editor is where a new feature gets its required name, so it opens
      // even when the draft does not yet pass schema validation.
      return { kind: 'details', id: event.id };
    }

    case 'deleted': {
      if (state.kind === 'drawing') return state;
      if (
        (state.kind === 'selected' || state.kind === 'details') &&
        state.id === event.id
      ) {
        return { kind: 'idle' };
      }
      return state;
    }
  }
}
