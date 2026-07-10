<script lang="ts">
  import { tweaks } from '$lib/state/tweaks.svelte';

  $effect(() => {
    const r = document.documentElement;
    r.style.setProperty('--sel-obs-glow',
      `drop-shadow(0 2px ${tweaks.obsGlowBlur}px rgba(0,165,227,${tweaks.obsGlowOpacity}))`);
    r.style.setProperty('--sel-line-glow',
      `drop-shadow(0 2px ${tweaks.lineGlowBlur}px rgba(0,165,227,${tweaks.lineGlowOpacity}))`);
    r.style.setProperty('--sel-poly-glow',
      `drop-shadow(0 2px ${tweaks.polyGlowBlur}px rgba(0,165,227,${tweaks.polyGlowOpacity}))`);
    r.style.setProperty('--sel-combi-glow',
      `drop-shadow(0 2px ${tweaks.combiGlowBlur}px rgba(0,165,227,${tweaks.combiGlowOpacity}))`);
    r.style.setProperty('--sel-landmark-scale', String(tweaks.landmarkScale));
    r.style.setProperty('--sel-landmark-shadow',
      `0 4px ${tweaks.landmarkShadowBlur}px rgba(0,0,0,0.2)`);
    r.style.setProperty('--sel-landmark-y-lift', `${tweaks.landmarkYLift}px`);
  });

  type Param = { key: keyof typeof tweaks; label: string; min: number; max: number; step: number };
  const groups: { title: string; params: Param[] }[] = [
    {
      title: 'Obstacle dot (Point)',
      params: [
        { key: 'obsRadius', label: 'Radius', min: 8, max: 20, step: 1 },
        { key: 'obsWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'obsGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'obsGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Obstacle line (LineString)',
      params: [
        { key: 'lineWeight', label: 'Weight', min: 1, max: 8, step: 0.5 },
        { key: 'lineGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'lineGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Obstacle polygon (Polygon)',
      params: [
        { key: 'polyWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'polyFillOpacity', label: 'Fill opacity', min: 0, max: 0.6, step: 0.05 },
        { key: 'polyGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'polyGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Combi fence',
      params: [
        { key: 'combiWeight', label: 'Weight', min: 1, max: 6, step: 0.5 },
        { key: 'combiFillOpacity', label: 'Fill opacity', min: 0, max: 0.4, step: 0.05 },
        { key: 'combiGlowBlur', label: 'Glow blur', min: 0, max: 24, step: 1 },
        { key: 'combiGlowOpacity', label: 'Glow opacity', min: 0, max: 1, step: 0.05 }
      ]
    },
    {
      title: 'Landmark pill',
      params: [
        { key: 'landmarkScale', label: 'Scale', min: 1, max: 1.3, step: 0.01 },
        { key: 'landmarkShadowBlur', label: 'Shadow blur', min: 0, max: 24, step: 1 },
        { key: 'landmarkYLift', label: 'Y lift (px)', min: 4, max: 20, step: 1 }
      ]
    }
  ];
</script>

<div
  class="fixed bottom-4 right-4 z-[2000] flex max-h-[80vh] w-64 flex-col overflow-y-auto rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur"
>
  <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
    Selected state tweaks
  </p>

  {#each groups as group}
    <details class="mb-1">
      <summary class="cursor-pointer py-1 text-xs font-semibold">{group.title}</summary>
      <div class="mt-1 flex flex-col gap-1.5 pl-1">
        {#each group.params as p}
          <label class="flex items-center gap-2">
            <span class="w-24 shrink-0 text-[11px] text-muted-foreground">{p.label}</span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={tweaks[p.key]}
              oninput={(e) => {
                (tweaks as Record<string, number>)[p.key] = Number(
                  (e.target as HTMLInputElement).value
                );
              }}
              class="flex-1"
            />
            <span class="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
              {tweaks[p.key]}
            </span>
          </label>
        {/each}
      </div>
    </details>
  {/each}
</div>
