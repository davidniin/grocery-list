// Vibración corta (Android). En iPhone no existe desde la web: no hace nada.
export function buzz(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sin vibración */ }
}
