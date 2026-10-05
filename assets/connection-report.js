/* Opt-in troubleshooting report. Metadata only, in RAM, never sends any data. */
(() => {
  'use strict';
  const button = document.getElementById('cloud-connection-report');
  if (!button || !window.HSCloudTransport) return;
  const environment = [];
  function record(type) {
    environment.push({at:new Date().toISOString(),type,online:navigator.onLine,visibility:document.visibilityState});
    if (environment.length > 10) environment.shift();
  }
  record('opened');
  window.addEventListener('online',() => record('online'));
  window.addEventListener('offline',() => record('offline'));
  document.addEventListener('visibilitychange',() => record('visibility'));
  function report() {
    const browser = navigator.userAgent.match(/(Edg|Chrome|Firefox)\/(\d+)/) || navigator.userAgent.match(/Version\/(\d+).*Safari/);
    return {
      reportFormat:'HSEDU_CONNECTION_V1',createdAt:new Date().toISOString(),
      pageMode:location.protocol === 'file:' ? 'local-file' : 'online',
      browser:browser ? browser[1] === 'Edg' ? 'Edge '+browser[2] : browser.length===2 ? 'Safari '+browser[1] : browser[1]+' '+browser[2] : 'unknown',
      readerVersion:document.querySelector('script[src*="cloud-read.js"]')?.getAttribute('src')?.split('?')[1] || 'unknown',
      state:document.getElementById('cloud-refresh-panel')?.dataset.state,
      motion:document.documentElement.dataset.hsMotion,
      online:navigator.onLine,
      hasConfirmedData:typeof cloudLoadedAt !== 'undefined' && cloudLoadedAt > 0,
      lastConfirmedAgeMs:typeof cloudLoadedAt !== 'undefined' && cloudLoadedAt > 0 ? Math.max(0,Date.now()-cloudLoadedAt) : null,
      pendingSaves:typeof pendingScoreSaves !== 'undefined' ? pendingScoreSaves : null,
      reads:window.HSCloudTransport.history(),environment:environment.map(entry => ({...entry}))
    };
  }
  button.addEventListener('click',event => {
    event.stopPropagation();
    const content = JSON.stringify(report(),null,2);
    const url = URL.createObjectURL(new Blob([content],{type:'application/json'}));
    const link = document.createElement('a');
    link.href = url;link.download = 'HSEduTrack_connection_report.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });
})();
