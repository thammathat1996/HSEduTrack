/* HONGSON Motion 3–4: presentation only. Scores, requests and persistence belong to the app. */
(() => {
  'use strict';
  const root = document.documentElement;
  const byId = id => document.getElementById(id);
  const enabled = () => root.dataset.hsMotion === 'full' && !document.hidden;
  const visible = el => el && !el.classList.contains('hidden') && el.getClientRects().length > 0;
  const running = new Map();
  const opened = new WeakMap();
  const seen = new WeakSet();
  let effectLayer;
  let effectTimer;
  let pageMode = '';

  function play(el, frames, options = {}) {
    if (!el || !enabled() || !visible(el) || typeof el.animate !== 'function') return;
    running.get(el)?.cancel();
    const animation = el.animate(frames, {duration:340, easing:'cubic-bezier(.22,.61,.36,1)', ...options});
    running.set(el, animation);
    const release = () => { if (running.get(el) === animation) running.delete(el); };
    animation.onfinish = release;
    animation.oncancel = release;
    return animation;
  }
  function enter(el, delay = 0) {
    play(el, [{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}], {delay,fill:'backwards'});
  }
  function pop(el, delay = 0) {
    play(el, [{transform:'scale(.94)'},{transform:'scale(1.05)',offset:.55},{transform:'scale(1)'}], {duration:420,delay});
  }
  function clearEffects() {
    clearTimeout(effectTimer);
    if (effectLayer) {
      for (const part of effectLayer.children) running.get(part)?.cancel();
      effectLayer.remove(); effectLayer = null;
    }
  }
  function stop() {
    running.forEach(animation => animation.cancel()); running.clear(); clearEffects();
  }
  function burst(target) {
    if (!enabled() || !visible(target)) return;
    clearEffects();
    const box = target.getBoundingClientRect();
    const x = Math.max(24, Math.min(innerWidth - 24, box.x + box.width / 2));
    const y = Math.max(24, Math.min(innerHeight - 24, box.y + box.height / 2));
    effectLayer = document.createElement('div');
    effectLayer.className = 'hs-reward-particles'; effectLayer.setAttribute('aria-hidden','true');
    document.body.appendChild(effectLayer);
    const colors = ['#72B01D','#3F7D20','#F3EFF5'];
    const count = innerWidth < 768 ? 12 : 18;
    for (let i = 0; i < count; i++) {
      const part = document.createElement('span');
      part.className = i % 3 === 0 ? 'hs-particle-star' : 'hs-particle-chip';
      part.style.left = x + 'px'; part.style.top = y + 'px'; part.style.backgroundColor = colors[i % colors.length];
      effectLayer.appendChild(part);
      const angle = i * 2.39996;
      const spread = Math.min(innerWidth * .28, 180) * (.55 + (i % 4) * .12);
      const dx = Math.cos(angle) * spread;
      const dy = -60 - (i % 5) * 22;
      play(part, [
        {opacity:0,transform:'translate(-50%,-50%) scale(.3) rotate(0deg)'},
        {opacity:1,transform:`translate(${dx * .5}px,${dy}px) scale(1) rotate(${i * 35}deg)`,offset:.35},
        {opacity:0,transform:`translate(${dx}px,${80 + i * 4}px) scale(.7) rotate(${i * 65 + 90}deg)`}
      ], {duration:900,delay:(i % 4) * 35,easing:'cubic-bezier(.2,.6,.4,1)',fill:'backwards'});
    }
    effectTimer = setTimeout(clearEffects,1100);
  }

  function chart() {
    if (!visible(byId('dashboard-view'))) return;
    const bars = byId('grade-chart-container')?.querySelectorAll(':scope > div > div[style*="height:"]') || [];
    [...bars].forEach((bar,i) => {
      bar.style.transformOrigin = 'center bottom';
      play(bar, [{transform:'scaleY(.05)'},{transform:'scaleY(1)'}], {duration:550,delay:i * 35,fill:'backwards'});
    });
  }
  function panelReveal(panel, delay = 0) {
    if (seen.has(panel)) return;
    seen.add(panel); enter(panel, delay);
    if (panel.contains(byId('grade-chart-container'))) chart();
  }
  const panelObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    let order = 0;
    for (const item of entries) if (item.isIntersecting && visible(item.target)) {
      panelReveal(item.target, Math.min(order++ * 70,140)); panelObserver.unobserve(item.target);
    }
  }, {threshold:0,rootMargin:'0px 0px -20px 0px'}) : null;
  function workspace() {
    const next = visible(byId('dashboard-view')) ? 'dashboard' : visible(byId('teacher-view')) ? 'teacher' : 'student';
    if (next === pageMode) return;
    pageMode = next; panelObserver?.disconnect();
    if (next === 'student') return;
    const panels = byId(next + '-view').querySelectorAll(next === 'dashboard' ? '.workspace-panel' : '.teacher-commandbar, .gradebook-toolbar');
    for (const panel of panels) {
      seen.delete(panel);
      if (panelObserver) panelObserver.observe(panel); else panelReveal(panel);
    }
    pop(byId('btn-mob-' + next)?.querySelector('.mobile-nav-icon'));
  }
  function modalChanged(modal) {
    const isOpen = visible(modal), wasOpen = opened.get(modal) || false;
    opened.set(modal,isOpen);
    if (isOpen === wasOpen) return;
    if (!isOpen) {
      running.get(modal)?.cancel();
      running.get(modal.firstElementChild)?.cancel();
      if (modal.id === 'gacha-reveal-modal' || modal.id === 'gacha-arcade-modal') clearEffects();
      return;
    }
    play(modal,[{opacity:0},{opacity:1}],{duration:150});
    play(modal.firstElementChild,[{opacity:0,transform:'translateY(14px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300});
    if (modal.id === 'gacha-reveal-modal') {
      pop(byId('reveal-sprite-img'),80); pop(byId('reveal-rarity-badge'),140); burst(byId('reveal-rarity-badge'));
    }
  }
  const modals = [...document.querySelectorAll('body > div[id$="-modal"], #app-loading-overlay')];
  for (const modal of modals) {
    opened.set(modal,visible(modal));
    new MutationObserver(() => modalChanged(modal)).observe(modal,{attributes:true,attributeFilter:['class']});
  }
  for (const view of ['student-view','dashboard-view','teacher-view']) {
    new MutationObserver(workspace).observe(byId(view),{attributes:true,attributeFilter:['class']});
  }
  for (const id of ['admin-tools-panel','arc-tab-content-quiz','arc-tab-content-gacha','arc-tab-content-showcase','arc-tab-content-score']) {
    const panel = byId(id); if (!panel) continue;
    opened.set(panel,visible(panel));
    new MutationObserver(() => {
      const showing = visible(panel), before = opened.get(panel); opened.set(panel,showing);
      if (showing && !before) enter(panel);
    }).observe(panel,{attributes:true,attributeFilter:['class']});
  }
  const saveStatus = byId('teacher-save-feedback');
  let lastSaveState = saveStatus?.dataset.state;
  if (saveStatus) new MutationObserver(() => {
    const state = saveStatus.dataset.state; if (state === lastSaveState) return;
    lastSaveState = state;
    if (state === 'saved') pop(saveStatus.querySelector('.icon-check'));
    if (state === 'error') pop(saveStatus.querySelector('.icon-alert'));
  }).observe(saveStatus,{attributes:true,attributeFilter:['data-state']});

  function question() {
    if (!visible(byId('gacha-arcade-modal')) || !visible(byId('arc-tab-content-quiz'))) return;
    enter(byId('qa-question-text'));
    [...byId('qa-choices-container').children].forEach((choice,i) => enter(choice,i * 45));
    clearEffects();
  }
  function quizResult(correct, confirmedReward) {
    if (!visible(byId('gacha-arcade-modal'))) return;
    const icon = byId('qa-result-icon');
    if (icon) icon.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#hs-icon-' + (correct ? 'check' : 'alert') + '"></use></svg>';
    enter(byId('qa-result-card')); pop(icon,70);
    if (correct && confirmedReward) { pop(byId('arc-coupon-badge')); burst(byId('qa-result-header')); }
  }
  function gachaBusy(busy) {
    byId('gacha-spheres-container')?.classList.toggle('hs-gacha-busy',busy);
    byId('gacha-pull-lever-btn')?.setAttribute('aria-busy',String(busy));
  }
  document.addEventListener('click',event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('#mobile-nav button, #app-header button[id^="btn-nav-"], .teacher-primary-actions > button, .teacher-more-list button, #gacha-arcade-modal button');
    if (control) pop(control.querySelector('.ui-icon, .mobile-nav-icon'));
  });
  document.addEventListener('change',event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.id === 'dash-class-selector') chart();
    if (event.target.matches('#teacher-gradebook-table input[id^="score-"], #teacher-gradebook-table input[id^="fixed-"]')) {
      play(event.target,[{boxShadow:'inset 0 0 0 3px #72B01D'},{boxShadow:'inset 0 0 0 0 transparent'}],{duration:500});
    }
  });
  document.addEventListener('toggle',event => {
    const details = event.target;
    if (details instanceof HTMLDetailsElement && details.open && details.closest('#teacher-view')) {
      [...details.children].filter(el => el.tagName !== 'SUMMARY').slice(0,4).forEach((el,i) => enter(el,i * 35));
    }
  },true);
  document.addEventListener('visibilitychange',() => {
    root.classList.toggle('hs-extras-paused',document.hidden);
    if (document.hidden) stop(); else workspace();
  });
  new MutationObserver(() => { if (root.dataset.hsMotion !== 'full') stop(); }).observe(root,{attributes:true,attributeFilter:['data-hs-motion']});
  root.classList.add('hs-extras-ready');
  root.classList.toggle('hs-extras-paused',document.hidden);
  window.HongSonExtras = Object.freeze({question,quizResult,gachaBusy,version:'20261001-1'});
  workspace();
})();