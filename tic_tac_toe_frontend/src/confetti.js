//
// Minimal, dependency-free confetti utility for celebratory effects.
// - Spawns a canvas overlay and animates confetti particles for a short duration.
// - Respects reduced motion and a caller-provided "animationsEnabled" flag.
// - Cleans up timers, RAF loops, and DOM nodes automatically.
// - Colors come from CSS variables to match theme/high-contrast modes.
//
// PUBLIC_INTERFACE
export function launchConfetti(options = {}) {
  /**
   * Launch a burst of confetti that auto-cleans after finishing.
   *
   * Options:
   * - durationMs: total time for the effect (default 1500)
   * - particleCount: number of confetti pieces (default 160)
   * - animationsEnabled: when false, the effect is no-op (default true)
   * - rootElement: element to which the overlay canvas is appended (default document.body)
   *
   * Returns a function cancel() that stops the effect and performs cleanup immediately.
   */
  const {
    durationMs = 1500,
    particleCount = 160,
    animationsEnabled = true,
    rootElement = document.body,
  } = options;

  // Honor reduced motion preference and caller's animations flag.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!animationsEnabled || prefersReducedMotion) {
    // No-op: return a cancel stub for API compatibility.
    return () => {};
  }

  // Create canvas overlay
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "none";
  canvas.style.mixBlendMode = "normal"; // keep subtle against dark/light
  // For high-contrast, leave it as is; colors will be computed below from CSS vars.

  rootElement.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Resize handler
  const onResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", onResize);

  // Resolve colors from CSS variables to fit current theme/high-contrast/palette
  const styles = getComputedStyle(rootElement);
  const colorText = styles.getPropertyValue("--text")?.trim() || "#111827";
  const colorPrimary = styles.getPropertyValue("--primary")?.trim() || "#2563EB";
  const colorSecondary = styles.getPropertyValue("--secondary")?.trim() || "#F59E0B";
  const colorSuccess = styles.getPropertyValue("--success")?.trim() || "#16a34a";

  // For high-contrast, favor text (near black/white) and primary for visibility.
  // We keep the palette small to avoid flashing/flaring issues and respect accessibility.
  const palette = [colorPrimary, colorSecondary, colorSuccess, colorText];

  // Create particles
  const rand = (min, max) => Math.random() * (max - min) + min;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const endTime = now() + durationMs;

  const particles = Array.from({ length: particleCount }).map(() => {
    const angle = rand(-Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); // mostly upward
    const speed = rand(180, 400);
    return {
      x: width / 2 + rand(-40, 40),
      y: height + rand(0, 20),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(4, 8),
      color: palette[Math.floor(rand(0, palette.length))],
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.2, 0.2),
      drag: 0.0005, // mild deceleration
      gravity: rand(280, 420), // pull-down
      shape: Math.random() < 0.5 ? "rect" : "circle",
      alpha: 1,
    };
  });

  let raf = 0;

  function drawRect(p) {
    const half = p.size / 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.fillRect(-half, -half, p.size, p.size * 0.7);
    ctx.restore();
  }

  function drawCircle(p) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function step(t) {
    ctx.clearRect(0, 0, width, height);
    const timeLeft = Math.max(0, endTime - t);
    const dt = 16.6667 / 1000; // approximate fixed timestep for stability

    particles.forEach((p) => {
      // Apply physics
      p.vy += p.gravity * dt;
      // Apply mild drag
      p.vx *= 1 - p.drag * 60;
      p.vy *= 1 - p.drag * 60;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed;

      // Fade out toward the end of lifespan
      if (timeLeft < durationMs * 0.5) {
        // linear fade
        const frac = timeLeft / (durationMs * 0.5);
        p.alpha = Math.max(0, frac);
      }

      // Draw particle
      if (p.shape === "rect") drawRect(p);
      else drawCircle(p);
    });

    // Continue until time over or all invisible/offscreen
    const allDone =
      timeLeft <= 0 ||
      particles.every((p) => p.alpha <= 0 || p.y - p.size > height + 20);

    if (!allDone) {
      raf = requestAnimationFrame(step);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  raf = requestAnimationFrame(step);

  // Return canceller to allow early termination from caller if needed.
  return cleanup;
}
