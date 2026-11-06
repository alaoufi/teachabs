// Reports script errors from the class pages to the server log (message, place and browser version only — no
// names, answers or lesson content), so problems on a real phone can be found without asking for screenshots.
let sent = 0;
function report(message, where) {
  if (sent++ >= 5) return;
  const body = JSON.stringify({message: String(message).slice(0, 300), where: String(where || '').slice(0, 200), page: location.pathname.replace(/[A-Z0-9]{6}/g, 'CODE'), ua: navigator.userAgent.slice(0, 200)});
  try { navigator.sendBeacon ? navigator.sendBeacon('/client-error', new Blob([body], {type: 'application/json'})) : fetch('/client-error', {method: 'POST', headers: {'content-type': 'application/json'}, body}); } catch { /* reporting must never break the page */ }
}
addEventListener('error', e => report(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}`));
addEventListener('unhandledrejection', e => report(e.reason?.message || e.reason, 'promise'));
