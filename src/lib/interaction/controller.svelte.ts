import {
  transition,
  type DrawTool,
  type InteractionConfig,
  type InteractionEvent,
  type InteractionState
} from './machine';

const SUPPRESS_MS = 400;

/** Pure deadline check so tests can pass a fake `now`. */
export function isClicksSuppressed(
  gestureActive: boolean,
  suppressUntil: number,
  now: number
): boolean {
  return gestureActive || now < suppressUntil;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function createInteractionController(options: {
  openDetailsOn: 'click' | 'dblclick';
  /** Called for Delete/Backspace when editable and a feature is selected or in details. */
  onDelete?: (id: string) => void;
  /** If this returns true, Escape closes the menu instead of changing interaction state. */
  isMenuOpen?: () => boolean;
  closeMenu?: () => void;
}) {
  const config: InteractionConfig = { openDetailsOn: options.openDetailsOn };

  let state = $state<InteractionState>({ kind: 'idle' });
  let gestureActive = $state(false);
  let suppressUntil = $state(0);

  function dispatch(event: InteractionEvent): void {
    state = transition(state, event, config);
  }

  function selectedId(): string | null {
    return state.kind === 'selected' || state.kind === 'details' ? state.id : null;
  }

  return {
    get state() {
      return state;
    },
    get selectedId() {
      return selectedId();
    },
    get detailsOpen() {
      return state.kind === 'details';
    },
    get tool(): DrawTool {
      return state.kind === 'drawing' ? state.tool : null;
    },
    get gesturesEnabled() {
      return state.kind !== 'drawing';
    },
    get clicksSuppressed() {
      return isClicksSuppressed(gestureActive, suppressUntil, Date.now());
    },

    dispatch,

    featureClick(id: string) {
      dispatch({ type: 'featureClick', id });
    },
    featureDoubleClick(id: string) {
      dispatch({ type: 'featureDoubleClick', id });
    },
    backgroundClick() {
      dispatch({ type: 'backgroundClick' });
    },
    closeDetails() {
      suppressUntil = Date.now() + SUPPRESS_MS;
      dispatch({ type: 'closeDetails' });
    },
    setTool(tool: DrawTool) {
      dispatch({ type: 'setTool', tool });
    },
    created(id: string, valid: boolean) {
      dispatch({ type: 'created', id, valid });
    },
    deleted(id: string) {
      dispatch({ type: 'deleted', id });
    },

    gestureStart() {
      gestureActive = true;
    },
    gestureEnd() {
      gestureActive = false;
      suppressUntil = Date.now() + SUPPRESS_MS;
    },

    handleKeydown(e: KeyboardEvent): void {
      if (e.defaultPrevented) return;

      if (e.key === 'Escape') {
        if (options.isMenuOpen?.()) {
          options.closeMenu?.();
          return;
        }
        // The dialog owns Escape while details are open and turns it into closeDetails.
        if (state.kind === 'details') return;
        dispatch({ type: 'escape' });
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isEditableTarget(e.target)) return;
        const id = selectedId();
        if (
          options.openDetailsOn === 'dblclick' &&
          id !== null &&
          state.kind !== 'drawing'
        ) {
          e.preventDefault();
          options.onDelete?.(id);
        }
      }
    }
  };
}

export type InteractionController = ReturnType<typeof createInteractionController>;
