<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    label,
    enabled,
    fraction = null,
    urgent = false,
    onclick
  }: {
    label: string;
    enabled: boolean;
    /** Share of the question's time left; null when untimed. */
    fraction?: number | null;
    urgent?: boolean;
    onclick: () => void;
  } = $props();

  const left = $derived(fraction === null ? 1 : Math.max(0, Math.min(1, fraction)));
</script>

<!-- The button is its own timer: the solid face drains right to left. -->
<button
  type="button"
  data-quiz-action
  class={cn('quiz-btn drain', enabled ? 'is-on' : 'is-off', urgent && 'is-urgent')}
  disabled={!enabled}
  style:--left={`${left * 100}%`}
  {onclick}
>
  <span class="face">{label}</span>
  <span class="face face--front" aria-hidden="true">{label}</span>
</button>

<style>
  .drain {
    overflow: hidden;
  }
  .face {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .face--front {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    clip-path: inset(0 calc(100% - var(--left)) 0 0);
  }

  .is-on {
    background: var(--bok-100);
    color: var(--bok-800);
    box-shadow: 0 4px 0 var(--bok-700);
  }
  .is-on .face--front {
    background: var(--bok-500);
    color: var(--white);
  }
  .is-off {
    background: var(--quiz-off);
    color: var(--quiz-off-text);
    box-shadow: 0 4px 0 var(--quiz-off-lip);
  }
  .is-off .face--front {
    background: #d6edf7;
    color: #86bcd4;
  }

  .is-on.is-urgent {
    background: var(--warning-bg);
    color: var(--warning);
    box-shadow: 0 4px 0 #a86700;
  }
  .is-on.is-urgent .face--front {
    background: var(--warning);
    color: var(--white);
  }
  .is-off.is-urgent .face--front {
    background: #f8dfb4;
    color: #c98a2a;
  }
</style>
