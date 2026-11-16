// The server always rechecks identity, schedule and admission. Never join using the device clock.
const refresh = () => { if (document.visibilityState === 'visible') location.reload(); else setTimeout(refresh, 15000); };
setTimeout(refresh, 15000);
