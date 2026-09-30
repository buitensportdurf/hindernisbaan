<script lang="ts">
  import { onMount, tick } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import LsBlockDialog from '$lib/components/LsBlockDialog.svelte';
  import { createInteractionController } from '$lib/interaction/controller.svelte';
  import { createAppState } from '$lib/state/app.svelte';
  import { isLocalStorageAvailable, readKey } from '$lib/storage/local';
  import { LANG_KEY, resolveInitialLocale, t, tf } from '$lib/i18n';
  import type { TKey } from '$lib/i18n/dict';
  import HistoryList from '$lib/quiz/HistoryList.svelte';
  import IntroSheet from '$lib/quiz/IntroSheet.svelte';
  import BinTerm from '$lib/quiz/BinTerm.svelte';
  import QuitDialog from '$lib/quiz/QuitDialog.svelte';
  import QuizLayer from '$lib/quiz/QuizLayer.svelte';
  import QuizPanel from '$lib/quiz/QuizPanel.svelte';
  import QuizRail from '$lib/quiz/QuizRail.svelte';
  import QuizSheet from '$lib/quiz/QuizSheet.svelte';
  import ReportCard from '$lib/quiz/ReportCard.svelte';
  import ResultReveal from '$lib/quiz/ResultReveal.svelte';
  import { Button } from '$lib/components/ui/button';
  import { formatRunDate } from '$lib/quiz/bins';
  import {
    OPTION_COUNT,
    TIER_COUNT,
    buildRun,
    isPass,
    isQuizzable,
    percentOf,
    RUN_LENGTH,
    RUN_LENGTH_MAX,
    runLengthOptions,
    type RunLength,
    type Outcome
  } from '$lib/quiz/quiz';
  import { loadFsOn, loadRunLength, loadRuns, loadSoundOn, saveFsOn, saveRun, saveRunLength, saveSoundOn, type RunRecord } from '$lib/quiz/runs';
  import { enterTestFullscreen, exitTestFullscreen, fullscreenAvailable } from '$lib/quiz/fullscreen';
  import { createQuizSession, type QuizSession } from '$lib/quiz/session.svelte';
  import { buzz, createSoundboard } from '$lib/quiz/sound';
  import type { QuizView, StampKind } from '$lib/quiz/view';
  import '$lib/quiz/quiz.css';

  /** The check button turns amber for the last seconds of a question. */
  const URGENT_MS = 5000;
  /** A soft tick sounds for each of the last seconds. */
  const TICK_FROM_S = 3;

  type Screen = 'intro' | 'run' | 'results' | 'review' | 'practiceDone';
  type Panel = { kind: 'history' } | { kind: 'report'; run: RunRecord; fromHistory: boolean };

  function lsblockPreview(): boolean {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('lsblock');
  }

  let storageOk = $state(!lsblockPreview());
  const initialLocale = resolveInitialLocale(
    typeof localStorage !== 'undefined' ? readKey(LANG_KEY) : null,
    typeof navigator !== 'undefined' ? navigator.language : undefined
  );

  const app = createAppState();
  const interaction = createInteractionController({
    openDetailsOn: 'click',
    isMenuOpen: () => app.menuOpen,
    closeMenu: () => app.closeMenu()
  });

  let screen = $state<Screen>('intro');
  let exam = $state.raw<QuizSession | null>(null);
  let practice = $state.raw<QuizSession | null>(null);
  let active = $state.raw<QuizSession | null>(null);
  let result = $state.raw<RunRecord | null>(null);
  let runs = $state.raw<RunRecord[]>([]);
  let panel = $state.raw<Panel | null>(null);
  let soundOn = $state(true);
  let fsOn = $state(true);
  let fsOk = $state(false);
  let runLength = $state<RunLength>(RUN_LENGTH);
  let quitOpen = $state(false);
  let reducedMotion = $state(false);
  let now = $state(0);
  let attempt = 0;
  let frameAttempt = $state(0);
  let lastTickSecond: number | null = null;

  let railEl = $state<HTMLElement | null>(null);
  let dockEl = $state<HTMLElement | null>(null);

  const sound = createSoundboard(() => soundOn);
  const locale = $derived(app.locale);

  const quizzable = $derived(app.features.filter(isQuizzable));
  const byId = $derived(new Map(quizzable.map((f) => [f.id, f])));
  const names = $derived(new Map(quizzable.map((f) => [f.id, f.properties.name])));
  const loading = $derived(app.loadState !== 'loaded');
  const tooFew = $derived(!loading && new Set(names.values()).size < OPTION_COUNT);
  const maxLength = $derived(loading ? RUN_LENGTH_MAX : Math.min(RUN_LENGTH_MAX, quizzable.length));
  const lengthOptions = $derived(runLengthOptions(maxLength));

  // ---------- Run lifecycle ----------

  function newSeed(): number {
    return (Math.random() * 2 ** 32) >>> 0;
  }

  function begin(session: QuizSession) {
    attempt += 1;
    frameAttempt = attempt;
    lastTickSecond = null;
    active = session;
    panel = null;
    screen = 'run';
    if (fsOn) void enterTestFullscreen();
  }

  function startExam() {
    if (loading || tooFew) return;
    sound.unlock();
    const seed = newSeed();
    exam = createQuizSession({
      questions: buildRun(app.features, seed, runLength),
      names,
      now: performance.now(),
      seed,
      dataVersion: app.dataVersion
    });
    practice = null;
    result = null;
    begin(exam);
  }

  function startPractice() {
    if (!exam) return;
    sound.unlock();
    practice = createQuizSession({
      questions: exam.mistakes.map((q) => ({ ...q, timeLimitMs: null })),
      names,
      now: performance.now(),
      practice: true
    });
    begin(practice);
  }

  function backToIntro() {
    exam = null;
    practice = null;
    active = null;
    result = null;
    panel = null;
    quitOpen = false;
    screen = 'intro';
    void exitTestFullscreen();
  }

  // ---------- Panels ----------

  /** Gets focus back once the last panel closes; panels replace each other in between. */
  let panelOpener: HTMLElement | null = null;

  function openPanel(next: Panel) {
    if (!panel) panelOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel = next;
  }

  async function closePanel() {
    panel = null;
    await tick();
    if (panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
    panelOpener = null;
  }

  function finishExam() {
    if (!exam) return;
    const record = exam.toRecord();
    runs = saveRun(record);
    result = record;
    active = null;
    screen = 'results';
  }

  function finished(session: QuizSession) {
    if (session === exam) finishExam();
    else {
      active = null;
      screen = 'practiceDone';
    }
  }

  function react(outcome: Outcome) {
    if (outcome === 'correct') {
      sound.stamp();
      sound.correct();
      buzz(15);
    } else {
      if (outcome === 'wrong') sound.wrong();
      else sound.timeout();
      buzz([30, 50, 30]);
    }
  }

  function pick(value: string) {
    active?.pick(value);
  }

  function check() {
    const s = active;
    if (!s) return;
    sound.unlock();
    const outcome = s.check(performance.now());
    if (outcome) react(outcome);
  }

  function next() {
    const s = active;
    if (!s) return;
    s.next(performance.now());
    lastTickSecond = null;
    if (s.phase === 'done') finished(s);
  }

  function requestQuit() {
    const s = active;
    if (!s) return;
    if (s.practice) {
      backToIntro();
      return;
    }
    s.pause(performance.now());
    quitOpen = true;
  }

  function quitOpenChange(open: boolean) {
    quitOpen = open;
    if (!open) active?.resume(performance.now());
  }

  function toggleSound() {
    soundOn = !soundOn;
    saveSoundOn(soundOn);
    if (soundOn) {
      sound.unlock();
      sound.stamp();
    }
  }

  function toggleFs() {
    fsOn = !fsOn;
    saveFsOn(fsOn);
    if (fsOn && (screen === 'run' || screen === 'results' || screen === 'review' || screen === 'practiceDone')) {
      void enterTestFullscreen();
    } else if (!fsOn) {
      void exitTestFullscreen();
    }
  }

  function setRunLength(next: RunLength) {
    runLength = next;
    saveRunLength(next);
  }

  // The clock: one frame loop per run drives the timers and the drain.
  $effect(() => {
    const s = active;
    if (screen !== 'run' || !s) return;
    let frame = 0;
    const loop = () => {
      const at = performance.now();
      now = at;
      const ticked = s.tick(at);
      if (ticked === 'timeout') react('timeout');
      else if (ticked === 'expired') {
        finished(s);
        return;
      }
      if (s.phase === 'question') {
        const left = s.remainingMs(at);
        const second = left === null ? null : Math.ceil(left / 1000);
        if (second !== null && second > 0 && second <= TICK_FROM_S && second !== lastTickSecond) {
          lastTickSecond = second;
          sound.tick();
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  });

  // ---------- What the screen shows ----------

  const question = $derived(screen === 'run' ? (active?.current ?? null) : null);
  const feedback = $derived(active?.phase === 'feedback');
  const outcome = $derived(feedback ? (active?.lastAnswer?.outcome ?? null) : null);
  const remaining = $derived(screen === 'run' && active ? active.remainingMs(now) : null);
  const fraction = $derived(
    remaining !== null && question?.timeLimitMs ? remaining / question.timeLimitMs : null
  );

  const eyebrow = $derived.by(() => {
    const s = active;
    if (!s || !question) return '';
    const label = s.practice ? t(locale, 'test.practice') : t(locale, `test.tier.${question.tier}` as TKey);
    return tf(locale, 'test.eyebrow', { tier: label, n: s.index + 1, total: s.questions.length });
  });

  const segments = $derived.by(() => {
    const s = active;
    if (!s) return [];
    const answered = s.answers.length;
    if (s.practice) return [s.questions.length ? Math.min(1, answered / s.questions.length) : 0];
    const out: number[] = [];
    for (let tier = 0; tier < TIER_COUNT; tier++) {
      const slots = s.questions.flatMap((q, i) => (q.tier === tier ? [i] : []));
      if (slots.length) out.push(slots.filter((i) => i < answered).length / slots.length);
    }
    return out;
  });

  /** Every feature asked so far keeps a label: its name when known, a question mark when missed. */
  const reviewing = $derived(screen === 'review' || screen === 'practiceDone');

  const stamps = $derived.by(() => {
    const out: Record<string, StampKind> = {};
    if (!exam || screen === 'intro') return out;
    // Every exam miss is a practice question, so its "?" would point at the answer.
    const practising = screen === 'run' && active === practice;
    for (const a of exam.answers) {
      if (a.outcome === 'correct') out[a.featureId] = 'known';
      else if (!practising) out[a.featureId] = 'missed';
    }
    for (const a of practice?.answers ?? []) out[a.featureId] = a.outcome === 'correct' ? 'known' : 'missed';
    const last = active?.phase === 'feedback' ? active.lastAnswer : null;
    if (last && last.outcome !== 'correct') out[last.featureId] = 'reveal';
    if (reviewing) {
      for (const id in out) if (out[id] === 'missed') out[id] = 'reveal';
    }
    return out;
  });

  const view = $derived.by((): QuizView => {
    const idle: QuizView = {
      frameKey: reviewing ? 'review' : 'course',
      frameIds: [],
      maxZoom: 18,
      targetId: null,
      halo: false,
      dimOthers: false,
      pickedId: null,
      rightId: null,
      wrongId: null,
      tappable: false,
      hideLandmarks: reviewing
    };
    const s = active;
    const q = question;
    if (!s || !q) return idle;
    const answer = feedback ? s.lastAnswer : null;
    const framed: QuizView = {
      ...idle,
      frameKey: `${frameAttempt}:${s.index}`,
      frameIds: q.frameIds,
      frameShift: q.frameShift ?? null,
      maxZoom: q.maxZoom,
      hideLandmarks: q.hideLandmarks
    };
    if (q.type === 'name') {
      return {
        ...framed,
        targetId: q.targetId,
        halo: !feedback,
        dimOthers: true,
        rightId: answer?.outcome === 'correct' ? q.targetId : null
      };
    }
    return {
      ...framed,
      tappable: !feedback,
      pickedId: feedback ? null : s.picked,
      targetId: answer && answer.outcome !== 'correct' ? q.targetId : null,
      halo: !!answer && answer.outcome !== 'correct',
      rightId: answer?.outcome === 'correct' ? q.targetId : null,
      wrongId: answer?.outcome === 'wrong' ? answer.picked : null
    };
  });

  function padding() {
    const top = screen === 'run' ? (railEl?.getBoundingClientRect().bottom ?? 0) : 0;
    const dockTop = dockEl?.firstElementChild ? dockEl.getBoundingClientRect().top : window.innerHeight;
    return {
      top: Math.max(0, top),
      bottom: Math.max(0, window.innerHeight - dockTop)
    };
  }

  const resultPercent = $derived(result ? percentOf(result.correct, result.total) : 0);
  const mistakes = $derived(exam?.mistakes.length ?? 0);

  // ---------- Keyboard ----------

  function onKeydown(e: KeyboardEvent) {
    const s = active;
    if (screen !== 'run' || !s || quitOpen || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = s.current;
    if (!q) return;
    if (/^[1-9]$/.test(e.key) && s.phase === 'question' && q.type === 'name') {
      const option = q.options[Number(e.key) - 1];
      if (option) {
        e.preventDefault();
        pick(option);
      }
      return;
    }
    if (e.key !== 'Enter') return;
    const control = (e.target as HTMLElement | null)?.closest('button, a, input');
    if (control && !control.matches('[data-quiz-tile], [data-quiz-action]')) return;
    e.preventDefault();
    if (s.phase === 'question') check();
    else if (s.phase === 'feedback') next();
  }

  onMount(() => {
    storageOk = lsblockPreview() ? false : isLocalStorageAvailable();
    runs = loadRuns();
    soundOn = loadSoundOn();
    fsOn = loadFsOn();
    fsOk = fullscreenAvailable();
    runLength = loadRunLength();

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = motion.matches;
    const onMotion = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
    motion.addEventListener('change', onMotion);

    // Leaving the tab pauses the clock instead of timing out every question.
    const onVisibility = () => {
      const s = active;
      if (!s || screen !== 'run') return;
      if (document.hidden) s.pause(performance.now());
      else if (!quitOpen) s.resume(performance.now());
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      void exitTestFullscreen();
    };
  });

  // Keeps Leaflet's attribution above the sheet on phones.
  $effect(() => {
    const el = dockEl;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--quiz-dock', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--quiz-dock');
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if !storageOk}
  <LsBlockDialog locale={initialLocale} />
{:else}
  <AppShell {app} {interaction} mode="test" showMenu={screen === 'intro'} fitFeatures={null}>
    {#snippet mapLayers()}
      {#if app.loadState === 'loaded'}
        <QuizLayer
          features={quizzable}
          landmarks={app.landmarks}
          {view}
          {stamps}
          {reducedMotion}
          {padding}
          onTap={pick}
        />
      {/if}
    {/snippet}

    {#snippet toolbar()}
      {#if screen === 'run' && active}
        <div class="rail-slot">
          <QuizRail
            bind:el={railEl}
            {locale}
            {segments}
            done={active.answers.length}
            total={active.questions.length}
            streak={active.practice ? null : active.streak}
            {soundOn}
            {fsOk}
            {fsOn}
            onToggleSound={toggleSound}
            onToggleFs={toggleFs}
            onQuit={requestQuit}
          />
        </div>
      {/if}
    {/snippet}

    {#snippet editorPanel()}
      <div class="dock" bind:this={dockEl}>
        {#if screen === 'intro'}
          <IntroSheet
            {locale}
            {runLength}
            lengths={lengthOptions}
            onLength={setRunLength}
            {loading}
            {tooFew}
            hasHistory={runs.length > 0}
            {soundOn}
            {fsOk}
            {fsOn}
            onToggleSound={toggleSound}
            onToggleFs={toggleFs}
            onStart={startExam}
            onHistory={() => openPanel({ kind: 'history' })}
          />
        {:else if screen === 'run' && active && question}
          {#key `${frameAttempt}:${active.index}`}
            <QuizSheet
              {locale}
              {question}
              targetName={names.get(question.targetId) ?? ''}
              isCombi={byId.get(question.targetId)?.properties.kind === 'combi'}
              {eyebrow}
              {feedback}
              picked={outcome === 'timeout' ? null : active.picked}
              {outcome}
              streak={active.practice ? null : active.streak}
              {fraction}
              urgent={remaining !== null && remaining <= URGENT_MS}
              onPick={pick}
              onCheck={check}
              onNext={next}
            />
          {/key}
        {:else if screen === 'review' && result}
          <section class="card" aria-label={t(locale, 'test.result')}>
            <p class="chip" class:pass={isPass(resultPercent)}>
              <BinTerm {locale} correct={result.correct} total={result.total} />
              · {resultPercent}%
            </p>
            <div class="card-actions card-actions--review">
              {#if mistakes > 0}
                <Button variant="outline" class="w-full" onclick={startPractice}>
                  {mistakes === 1
                    ? t(locale, 'test.result.practice.one')
                    : tf(locale, 'test.result.practice', { n: mistakes })}
                </Button>
              {/if}
              <Button class="w-full" onclick={backToIntro}>
                {t(locale, 'test.result.done')}
              </Button>
            </div>
          </section>
        {:else if screen === 'practiceDone'}
          <section class="card" aria-labelledby="practice-done-title">
            <h2 id="practice-done-title" class="card-title">{t(locale, 'test.practiceDone.title')}</h2>
            <p class="card-body">{t(locale, 'test.practiceDone.body')}</p>
            <div class="card-actions">
              <Button variant="outline" size="sm" class="w-full" onclick={backToIntro}>
                {t(locale, 'test.result.done')}
              </Button>
              <Button class="w-full" onclick={startExam}>
                {t(locale, 'test.practiceDone.again')}
              </Button>
            </div>
          </section>
        {/if}
      </div>

      {#if screen === 'results' && result}
        <ResultReveal
          {locale}
          run={result}
          {runs}
          {mistakes}
          {sound}
          {reducedMotion}
          onMap={() => (screen = 'review')}
          onPractice={startPractice}
          onReport={() => result && openPanel({ kind: 'report', run: result, fromHistory: false })}
          onClose={backToIntro}
        />
      {/if}

      {#if panel?.kind === 'history'}
        <QuizPanel
          title={t(locale, 'test.history.title')}
          closeLabel={t(locale, 'test.close')}
          onClose={closePanel}
        >
          <HistoryList
            {locale}
            {runs}
            onOpen={(run) => openPanel({ kind: 'report', run, fromHistory: true })}
          />
        </QuizPanel>
      {:else if panel?.kind === 'report'}
        {@const run = panel.run}
        {@const pct = percentOf(run.correct, run.total)}
        <QuizPanel
          title={t(locale, 'test.report.title')}
          closeLabel={t(locale, panel.fromHistory ? 'test.back' : 'test.close')}
          back={panel.fromHistory}
          onClose={() => (panel?.kind === 'report' && panel.fromHistory ? openPanel({ kind: 'history' }) : closePanel())}
        >
          {#snippet header()}
            <div class="report-head">
              <h2 class="report-bin" class:pass={isPass(pct)}>
                <BinTerm {locale} correct={run.correct} total={run.total} />
              </h2>
              <p class="report-score">
                <b>{pct}%</b> · {tf(locale, 'test.result.score', { correct: run.correct, total: run.total })}
              </p>
              <p class="report-date">{formatRunDate(locale, run.startedAt)}</p>
            </div>
          {/snippet}
          <ReportCard {locale} {run} />
        </QuizPanel>
      {/if}

      <QuitDialog bind:open={quitOpen} {locale} onOpenChange={quitOpenChange} onConfirm={backToIntro} />
    {/snippet}
  </AppShell>
{/if}

<style>
  .rail-slot {
    position: fixed;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 1100;
  }
  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1100;
  }
  @media (min-width: 640px) {
    .rail-slot {
      top: 16px;
      left: 50%;
      right: auto;
      width: 440px;
      margin-left: -220px;
    }
    .dock {
      left: 50%;
      right: auto;
      bottom: 16px;
      width: 440px;
      margin-left: -220px;
    }
  }

  .card {
    padding: 18px 18px calc(18px + env(safe-area-inset-bottom, 0px));
    background: var(--white);
    border-radius: 22px 22px 0 0;
    box-shadow: var(--quiz-sheet-shadow);
    animation: card-up 360ms var(--ease-out) both;
  }
  @media (min-width: 640px) {
    .card {
      padding-bottom: 18px;
      border-radius: 22px;
      box-shadow: 0 10px 36px rgba(0, 0, 0, 0.16);
    }
  }
  .card-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--success);
  }
  .card-body {
    margin-top: 4px;
    font-size: 15px;
    color: var(--ink-600);
  }
  .card-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 16px;
  }
  .card-actions:has(> :nth-child(2)) {
    grid-template-columns: 1fr 1fr;
  }
  /* "Oefen je 5 fouten" needs more room than "Klaar". */
  .card-actions--review:has(> :nth-child(2)) {
    grid-template-columns: 1.45fr 1fr;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 6px 12px;
    border-radius: 99px;
    background: var(--sand-100);
    color: var(--sand-700);
    font-size: 14px;
    font-weight: var(--fw-bold);
  }
  .chip :global(button) {
    font: inherit;
    color: inherit;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }
  .chip.pass {
    background: var(--success-bg);
    color: var(--success);
  }

  .report-bin {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--sand-700);
  }
  .report-bin :global(button) {
    font: inherit;
    color: inherit;
    text-align: left;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 4px;
  }
  .report-bin.pass {
    color: var(--success);
  }
  .report-score {
    margin-top: 3px;
    font-size: 14px;
    color: var(--ink-600);
  }
  .report-score b {
    font-weight: 800;
    color: var(--ink-800);
  }
  .report-date {
    margin-top: 1px;
    font-size: 12px;
    color: var(--gray-500);
  }

  @keyframes card-up {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: none; opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
