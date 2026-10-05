/* Presentation only: reacts to visible elements, never fetches, edits or stores scores. */
(() => {
  'use strict';
  const root = document.documentElement;
  const lookup = document.getElementById('student-search-panel');
  const student = document.getElementById('student-view');
  const result = document.getElementById('student-result');
  const summary = document.getElementById('student-score-summary');
  if (!lookup || !student || !result || !summary) return;
  const enabled = () => root.dataset.hsMotion === 'full' && !document.hidden;
  const visible = el => el && !el.classList.contains('hidden') && el.getClientRects().length > 0;
  const active = new Set();
  const timers = new Set();
  let layer;
  let mode = '';
  let lookupInView = true;
  let lastBurstAt = -Infinity;

  function later(fn, delay) {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay);
    timers.add(timer);
  }
  function stop() {
    timers.forEach(clearTimeout); timers.clear();
    active.forEach(animation => animation.cancel()); active.clear();
    layer?.remove(); layer = null;
    summary.classList.remove('hs-score-arrived');
  }
  function play(el, frames, options) {
    if (!enabled() || typeof el.animate !== 'function') return null;
    const animation = el.animate(frames, {easing:'cubic-bezier(.16,1,.3,1)',...options});
    active.add(animation);
    const done = () => active.delete(animation);
    animation.onfinish = done; animation.oncancel = done;
    return animation;
  }
  function effectLayer() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'hs-delight-layer'; layer.setAttribute('aria-hidden','true');
      document.body.appendChild(layer);
    }
    return layer;
  }
  function removePart(part) {
    part.remove();
    if (layer && !layer.childElementCount) { layer.remove(); layer = null; }
  }
  function press(button, event) {
    if (!enabled() || button.disabled || !visible(button)) return;
    if (layer && layer.childElementCount >= 24) return;
    const box = button.getBoundingClientRect();
    const pointer = event.detail > 0 && Number.isFinite(event.clientX);
    const x = pointer ? event.clientX : box.x + box.width / 2;
    const y = pointer ? event.clientY : box.y + box.height / 2;
    const part = document.createElement('span');part.className = 'hs-press-ring';
    part.style.left = x + 'px';part.style.top = y + 'px';effectLayer().appendChild(part);
    play(part,[{opacity:.75,transform:'translate(-50%,-50%) scale(.5) rotate(0)'},
      {opacity:0,transform:'translate(-50%,-50%) scale(3.5) rotate(30deg)'}],{duration:400});
    later(() => removePart(part),450);
  }
  function arrival() {
    if (!enabled() || !visible(summary)) return;
    summary.classList.add('hs-score-arrived');
    later(() => summary.classList.remove('hs-score-arrived'),1100);
    const grade = document.getElementById('res-grade-card');
    if (!grade || performance.now() - lastBurstAt < 1500) return;
    const box = grade.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;
    lastBurstAt = performance.now();
    const x = Math.min(innerWidth-16,Math.max(16,box.left+box.width/2));
    const y = Math.min(innerHeight-16,Math.max(16,box.top+box.height/2));
    const count = innerWidth < 768 ? 8 : 12;
    for (let i=0;i<count;i++) {
      const part=document.createElement('span');part.className='hs-delight-chip';
      part.style.left=x+'px';part.style.top=y+'px';effectLayer().appendChild(part);
      const angle=i * Math.PI * 2 / count,spread=innerWidth<768?44:64;
      const dx=Math.cos(angle)*spread,dy=Math.sin(angle)*spread;
      play(part,[{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},
        {opacity:1,transform:'translate('+(dx*.55)+'px,'+(dy*.55)+'px) scale(1) rotate('+(i*30)+'deg)',offset:.3},
        {opacity:0,transform:'translate('+dx+'px,'+(dy+20)+'px) scale(.6) rotate('+(i*45+60)+'deg)'}],
        {duration:700,delay:i%3*30,fill:'backwards'});
      later(() => removePart(part),850);
    }
  }
  function workspace() {
    const next = !visible(student) ? 'other' : visible(result) ? 'result' : 'lookup';
    lookup.classList.toggle('hs-experience-ambient',next==='lookup' && lookupInView && enabled());
    if (next === mode) return;
    mode = next; stop();
    if (next === 'result') arrival();
  }
  const observer=new MutationObserver(workspace);
  for (const el of [student,result,lookup]) observer.observe(el,{attributes:true,attributeFilter:['class']});
  // Only observe the mode attribute: effect classes cannot restart their own observer.
  new MutationObserver(() => {
    if (!enabled()) stop();
    lookup.classList.toggle('hs-experience-ambient',mode==='lookup' && lookupInView && enabled());
  }).observe(root,{attributes:true,attributeFilter:['data-hs-motion']});
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    lookupInView=entries[0].isIntersecting;
    lookup.classList.toggle('hs-experience-ambient',mode==='lookup' && lookupInView && enabled());
  }).observe(lookup);
  document.addEventListener('click',event => {
    if (!(event.target instanceof Element)) return;
    const button=event.target.closest('#student-search-button, #student-result .student-quick-card, #student-result [data-task-filter], #student-result .student-activity-link, #mobile-nav button');
    if (button) press(button,event);
  });
  document.addEventListener('visibilitychange',() => {
    root.classList.toggle('hs-experience-paused',document.hidden);
    if (document.hidden) stop();
    lookup.classList.toggle('hs-experience-ambient',mode==='lookup' && lookupInView && enabled());
  });
  window.addEventListener('pagehide',stop);
  root.classList.toggle('hs-experience-paused',document.hidden);
  workspace();
})();
