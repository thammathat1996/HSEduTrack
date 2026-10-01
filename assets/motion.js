/* HONGSON Motion. This module only animates presentation; it never reads/writes scores or storage. */
(() => {
  'use strict';
  const lookupPanel = document.getElementById('student-search-panel');
  const studentView = document.getElementById('student-view');
  const resultPanel = document.getElementById('student-result');
  if (!lookupPanel || !studentView || !resultPanel) return;
  // Full motion is explicitly selected for this site; the OS setting is never changed.
  if (!document.documentElement.dataset.hsMotion) {
    document.documentElement.dataset.hsMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
  }
  const motionEnabled = () => document.documentElement.dataset.hsMotion === 'full';
  const running = new Map();
  const seenTasks = new Set();
  let seenPanels = new WeakSet();
  let mode = 'off';
  let lookupTimer;
  const visibleStudent = () => !studentView.classList.contains('hidden') && !document.hidden;
  const taskKey = row => row.dataset.motionTask || row.querySelector('.student-task-title')?.textContent || '';

  function play(element, frames, options = {}) {
    if (!element || !motionEnabled() || document.hidden || typeof element.animate !== 'function') return;
    running.get(element)?.cancel();
    const animation = element.animate(frames, {
      duration: 600, easing: 'cubic-bezier(.16,1,.3,1)', ...options
    });
    running.set(element, animation);
    const release = () => { if (running.get(element) === animation) running.delete(element); };
    animation.onfinish = release;
    animation.oncancel = release;
    return animation;
  }

  function stop() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }

  function enter(element, delay = 0, distance = 24) {
    const base = getComputedStyle(element).transform;
    play(element, [
      { opacity: 0, transform: 'translateY(' + distance + 'px) ' + (base === 'none' ? '' : base) },
      { opacity: 1, transform: base === 'none' ? 'translateY(0)' : base }
    ], { duration: 680, delay, easing:'cubic-bezier(.22,.61,.36,1)', fill:'backwards' });
  }

  function statusMotion(row) {
    const icon = row.querySelector('.status-mini');
    if (row.dataset.status === 'graded') {
      play(icon, [{strokeDasharray:'24',strokeDashoffset:24},{strokeDasharray:'24',strokeDashoffset:0}], {duration:440,easing:'ease-out'});
    } else if (row.dataset.status === 'pending') {
      play(icon, [{transform:'rotate(0)'},{transform:'rotate(-18deg)',offset:.35},{transform:'rotate(12deg)',offset:.7},{transform:'rotate(0)'}], {duration:480});
    } else {
      play(icon, [{transform:'scale(.85)'},{transform:'scale(1.12)',offset:.55},{transform:'scale(1)'}], {duration:350});
    }
  }

  function revealTask(row, delay = 0) {
    if (row.hidden || !row.isConnected) return;
    seenTasks.add(taskKey(row));
    enter(row, delay, 16);
    statusMotion(row);
  }

  const rowObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (mode !== 'result' || !visibleStudent()) return;
    let order = 0;
    for (const entry of entries) {
      const row = entry.target;
      if (!entry.isIntersecting || row.hidden) continue;
      if (!seenTasks.has(taskKey(row))) revealTask(row, Math.min(order++ * 70, 210));
      rowObserver.unobserve(row);
    }
  }, {threshold:.08}) : null;

  function tasks() {
    rowObserver?.disconnect();
    if (mode !== 'result' || !visibleStudent()) return;
    for (const row of resultPanel.querySelectorAll('.student-task-row')) {
      if (seenTasks.has(taskKey(row))) continue;
      if (rowObserver) rowObserver.observe(row);
      else seenTasks.add(taskKey(row));
    }
  }

  function revealPanel(panel, delay) {
    seenPanels.add(panel);
    enter(panel, delay);
    if (panel.classList.contains('student-profile-card')) {
      play(document.getElementById('res-grade-card'), [{transform:'scale(.94)'},{transform:'scale(1.04)',offset:.6},{transform:'scale(1)'}], {duration:600,delay:delay+80});
      play(panel.querySelector('.hs-grade-spark'), [{opacity:0,transform:'scale(.3) rotate(-60deg)'},{opacity:1,transform:'scale(1.15) rotate(8deg)',offset:.65},{opacity:1,transform:'scale(1) rotate(0)'}], {duration:650,delay:delay+120});
    }
    if (panel.id === 'student-score-summary') {
      play(document.getElementById('res-score-total'), [{transform:'scale(.96)'},{transform:'scale(1.05)',offset:.6},{transform:'scale(1)'}], {duration:400,delay:delay+50});
      play(document.getElementById('res-progress-bar'), [{transform:'scaleX(0)'},{transform:'scaleX(1)'}], {duration:750,delay:delay+100,fill:'backwards'});
    }
  }

  const panelObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (mode !== 'result' || !visibleStudent()) return;
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting || seenPanels.has(entry.target)) continue;
      revealPanel(entry.target, Math.min(order++ * 110, 220));
      panelObserver.unobserve(entry.target);
    }
  }, {threshold:0,rootMargin:'0px 0px -24px 0px'}) : null;

  const ambientObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('hs-ambient-visible', entry.isIntersecting);
  }) : null;

  function ambient(active) {
    lookupPanel.classList.toggle('hs-ambient-active', active && !document.hidden && motionEnabled());
  }

  function lookup() {
    if (!visibleStudent() || lookupPanel.classList.contains('hidden')) return;
    mode = 'lookup';
    panelObserver?.disconnect();
    rowObserver?.disconnect();
    stop();
    ambient(true);
    clearTimeout(lookupTimer);
    lookupPanel.classList.remove('hs-lookup-enter');
    void lookupPanel.offsetWidth;
    lookupPanel.classList.add('hs-lookup-enter');
    lookupTimer = setTimeout(() => lookupPanel.classList.remove('hs-lookup-enter'), 1200);
    const content = lookupPanel.querySelector('.brand-hero-content');
    [...content.children].filter(element => !element.id).forEach((element,index) => enter(element, Math.min(index*80,240),16));
  }

  function result(resetTasks = true) {
    if (!visibleStudent() || resultPanel.classList.contains('hidden')) return;
    mode = 'result';
    ambient(false);
    stop();
    seenPanels = new WeakSet();
    if (resetTasks) seenTasks.clear();
    panelObserver?.disconnect();
    for (const panel of resultPanel.querySelectorAll(':scope > .workspace-panel')) {
      if (panelObserver) panelObserver.observe(panel);
      else seenPanels.add(panel);
    }
    tasks();
  }

  function workspace() {
    if (!visibleStudent()) {
      mode = 'off'; ambient(false); stop();
      panelObserver?.disconnect(); rowObserver?.disconnect();
    } else if (resultPanel.classList.contains('hidden')) {
      if (mode !== 'lookup') lookup(); else ambient(true);
    } else if (mode !== 'result') result(false);
  }

  // Inline app handlers complete first. This listener supplies only visual feedback.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !visibleStudent()) return;
    const control = event.target.closest('#student-result [data-task-filter], #student-result .student-quick-card');
    if (!control) return;
    const rows = [...resultPanel.querySelectorAll('.student-task-row')].filter(row => {
      if (row.hidden) return false;
      const rect = row.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    rows.forEach((row,index) => { rowObserver?.unobserve(row); revealTask(row,Math.min(index*55,165)); });
    tasks();
    play(control.querySelector('strong'), [{transform:'scale(1)'},{transform:'scale(1.08)',offset:.45},{transform:'scale(1)'}], {duration:320});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ambient(false); stop(); }
    else { workspace(); if (mode === 'result') tasks(); }
  });
  const motionToggle = document.getElementById('hs-motion-toggle');
  function updateMotionControl() {
    if (!motionToggle) return;
    const enabled = motionEnabled();
    motionToggle.setAttribute('aria-pressed', String(enabled));
    motionToggle.setAttribute('aria-label', enabled ? 'ลดภาพเคลื่อนไหว' : 'เปิดภาพเคลื่อนไหว');
    motionToggle.title = enabled ? 'ลดภาพเคลื่อนไหวเฉพาะเว็บ' : 'เปิดภาพเคลื่อนไหวเฉพาะเว็บ';
    motionToggle.querySelector('span').textContent = enabled ? 'เอฟเฟกต์: เปิด' : 'เอฟเฟกต์: ลด';
  }
  motionToggle?.addEventListener('click', () => {
    document.documentElement.dataset.hsMotion = motionEnabled() ? 'reduced' : 'full';
    updateMotionControl();
    if (!motionEnabled()) { stop(); ambient(false); }
    else if (mode === 'lookup') lookup();
    else if (mode === 'result') result(false);
    else workspace();
  });
  updateMotionControl();
  window.HongSonMotion = Object.freeze({lookup,result,tasks,workspace,version:'20261001-3'});
  document.documentElement.classList.add('hs-motion-ready');
  for (const art of lookupPanel.querySelectorAll('.brand-hero-mark')) {
    if (ambientObserver) ambientObserver.observe(art);
    else art.classList.add('hs-ambient-visible');
  }
  play(document.querySelector('.brand-spark--nav'), [{transform:'rotate(-14deg)'},{transform:'rotate(346deg)'}], {duration:800});
  workspace();
})();
