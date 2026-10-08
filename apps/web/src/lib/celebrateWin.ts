export async function celebrateWin() {
  const { default: confetti } = await import('canvas-confetti');

  confetti({
    particleCount: 72,
    spread: 68,
    startVelocity: 34,
    origin: { y: 0.68 },
    disableForReducedMotion: true,
    zIndex: 120,
  });
}
