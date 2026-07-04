import { VisualizerConfig, VisualizerStyle } from "@/store/editorState";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life?: number;
  maxLife?: number;
}

// Global particle cache to persist particle positions across frame renders.
// Keyed by visualizer style so settings switch cleanly.
class ParticleSystem {
  particles: Particle[] = [];
  lastAmount = 0;

  update(amount: number, width: number, height: number, style: VisualizerStyle, bassEnergy: number) {
    if (this.lastAmount !== amount || this.particles.length === 0) {
      this.particles = [];
      for (let i = 0; i < amount; i++) {
        this.particles.push(this.createParticle(width, height, style, true));
      }
      this.lastAmount = amount;
    }

    const scale = Math.min(width, height) / 1080;

    // Update and drift
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (style === "ncs") {
        // NCS particles drift outwards from center
        const cx = width / 2;
        const cy = height / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Speed multiplier on bass drop
        const speed = (0.5 + bassEnergy * 4) * (1 + p.vx) * scale * dtScale; 
        
        if (dist < 10 * scale) {
          p.x = cx + (Math.random() - 0.5) * 20 * scale;
          p.y = cy + (Math.random() - 0.5) * 20 * scale;
        } else {
          p.x += (dx / dist) * speed;
          p.y += (dy / dist) * speed;
        }

        p.alpha = Math.min(1, (dist / (width / 2.5)));
        
        // Recycle if out of bounds
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          this.particles[i] = this.createParticle(width, height, style, false);
        }
      } else if (style === "wave") {
        // Wave particles float vertically upwards
        const speed = (0.3 + bassEnergy * 3) * p.vy * scale * dtScale;
        p.y -= speed;
        p.x += Math.sin(p.y / (30 * scale) + p.size) * 0.3 * scale * dtScale; // subtle wiggle

        // Recycle if floats off top
        if (p.y < -10) {
          this.particles[i] = this.createParticle(width, height, style, false);
        }
      } else if (style === "galaxy") {
        // Galaxy particles orbit the center orb or float outward as explosions
        if (p.life !== undefined && p.maxLife !== undefined) {
          p.life--;
          p.x += p.vx * (1 + bassEnergy * 2) * scale * dtScale;
          p.y += p.vy * (1 + bassEnergy * 2) * scale * dtScale;
          p.alpha = p.life / p.maxLife;

          if (p.life <= 0) {
            this.particles[i] = this.createParticle(width, height, style, false);
          }
        } else {
          // Ambient orbiting stars
          const cx = width / 2;
          const cy = height / 2;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Orbital rotation
          const angle = Math.atan2(dy, dx) + 0.002 * (1 + bassEnergy * 2) * dtScale;
          p.x = cx + Math.cos(angle) * dist;
          p.y = cy + Math.sin(angle) * dist;
          
          // Slow drift outwards
          p.x += Math.cos(angle) * 0.1 * scale * dtScale;
          p.y += Math.sin(angle) * 0.1 * scale * dtScale;

          if (dist > Math.max(width, height)) {
            this.particles[i] = this.createParticle(width, height, style, false);
          }
        }
      } else if (style === "lyrics") {
        // Embers floating upward and wiggling gently
        const speed = (0.25 + bassEnergy * 2.2) * p.vy * scale * dtScale;
        p.y -= speed;
        p.x += p.vx * scale * dtScale + Math.sin(p.y / (40 * scale) + p.size) * 0.25 * scale * dtScale;

        // Subtly fade and pulse alpha based on audio energy
        p.alpha = Math.max(0.05, Math.min(1.0, p.alpha + (Math.random() - 0.5) * 0.02));

        // Recycle if floats off top or sides
        if (p.y < -10 || p.x < -10 || p.x > width + 10) {
          this.particles[i] = this.createParticle(width, height, style, false);
        }
      }
    }
  }

  createParticle(width: number, height: number, style: VisualizerStyle, isInitial = false): Particle {
    const cx = width / 2;
    const cy = height / 2;

    if (style === "ncs") {
      // Spawn closer to center initially, or on recycle at center
      const angle = Math.random() * Math.PI * 2;
      const dist = isInitial ? Math.random() * (width / 3) : Math.random() * 20;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.random() * 2 + 0.5, // acts as speed factor
        vy: 0,
        size: Math.random() * 3 + 1,
        color: "#ffffff",
        alpha: isInitial ? Math.random() : 0,
      };
    } else if (style === "wave") {
      // Spawn at bottom
      return {
        x: Math.random() * width,
        y: isInitial ? Math.random() * height : height + 10,
        vx: 0,
        vy: Math.random() * 1.5 + 0.5, // speed factor
        size: Math.random() * 4 + 1.5,
        color: "#ffffff",
        alpha: Math.random() * 0.7 + 0.3,
      };
    } else if (style === "lyrics") {
      // Spawn across the screen with organic positions and random alphas
      return {
        x: Math.random() * width,
        y: isInitial ? Math.random() * height : height + 10,
        vx: (Math.random() - 0.5) * 0.5, // horizontal drift
        vy: Math.random() * 0.8 + 0.3, // slow upward float speed
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.65 ? "primary" : Math.random() > 0.3 ? "secondary" : "#ffffff",
        alpha: Math.random() * 0.6 + 0.1,
      };
    } else {
      // Galaxy style.
      // 30% are explosive sparks (only if not initial spawn)
      if (!isInitial && Math.random() < 0.25) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        const maxLife = Math.random() * 40 + 20;
        return {
          x: cx + Math.cos(angle) * 20,
          y: cy + Math.sin(angle) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3.5 + 1.5,
          color: Math.random() > 0.5 ? "primary" : "secondary", // handled in draw
          alpha: 1,
          life: maxLife,
          maxLife: maxLife,
        };
      } else {
        // Starfield stars
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (Math.max(width, height) / 2);
        return {
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
          size: Math.random() * 2 + 0.5,
          color: "#ffffff",
          alpha: Math.random() * 0.8 + 0.2,
        };
      }
    }
  }

  triggerExplosion(count: number, width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;
    // Replace oldest non-explosion particles
    let exploded = 0;
    for (let i = 0; i < this.particles.length && exploded < count; i++) {
      const p = this.particles[i];
      if (p.life === undefined) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3;
        const maxLife = Math.random() * 50 + 20;
        this.particles[i] = {
          x: cx + Math.cos(angle) * 30,
          y: cy + Math.sin(angle) * 30,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 1.5,
          color: Math.random() > 0.5 ? "primary" : "secondary",
          alpha: 1,
          life: maxLife,
          maxLife: maxLife,
        };
        exploded++;
      }
    }
  }
}

let lastTime = 0;
let dtScale = 1.0;

const particleSystem = new ParticleSystem();

export function blendHexColors(c1: string, c2: string, ratio: number): string {
  let clean1 = c1.replace("#", "");
  let clean2 = c2.replace("#", "");
  if (clean1.length === 3) clean1 = clean1.split("").map((x) => x + x).join("");
  if (clean2.length === 3) clean2 = clean2.split("").map((x) => x + x).join("");
  
  const r1 = parseInt(clean1.substring(0, 2), 16) || 0;
  const g1 = parseInt(clean1.substring(2, 4), 16) || 0;
  const b1 = parseInt(clean1.substring(4, 6), 16) || 0;

  const r2 = parseInt(clean2.substring(0, 2), 16) || 0;
  const g2 = parseInt(clean2.substring(2, 4), 16) || 0;
  const b2 = parseInt(clean2.substring(4, 6), 16) || 0;

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  const hex = (val: number) => val.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

class ShockwaveSystem {
  ripples: { radius: number; alpha: number; maxRadius: number }[] = [];
  
  update(isBassPeak: boolean, baseRadius: number, scale: number) {
    if (isBassPeak && (this.ripples.length === 0 || this.ripples[this.ripples.length - 1].radius > baseRadius * 1.25)) {
      this.ripples.push({
        radius: baseRadius,
        alpha: 1.0,
        maxRadius: baseRadius * 2.3
      });
    }
    
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 8.5 * scale * dtScale;
      r.alpha = 1.0 - (r.radius - baseRadius) / (r.maxRadius - baseRadius);
      
      if (r.radius >= r.maxRadius || r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }
  
  draw(ctx: any, cx: number, cy: number, color: string, thickness: number, scale: number) {
    ctx.save();
    for (const r of this.ripples) {
      ctx.strokeStyle = hexToRgba(color, r.alpha * 0.35);
      ctx.lineWidth = thickness * 1.5 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
const ncsShockwaves = new ShockwaveSystem();

class PeakTrackerSystem {
  peaks: Float32Array | null = null;
  velocities: Float32Array | null = null;
  
  update(barHeights: Float32Array, scale: number) {
    const len = barHeights.length;
    if (!this.peaks || this.peaks.length !== len) {
      this.peaks = new Float32Array(len);
      this.velocities = new Float32Array(len);
    }
    
    const peaks = this.peaks!;
    const velocities = this.velocities!;
    const gravity = 0.28 * scale * dtScale;
    
    for (let i = 0; i < len; i++) {
      const h = barHeights[i];
      if (h > peaks[i]) {
        peaks[i] = h;
        velocities[i] = 0;
      } else {
        velocities[i] += gravity;
        peaks[i] -= velocities[i] * dtScale;
        if (peaks[i] < 0) {
          peaks[i] = 0;
          velocities[i] = 0;
        }
      }
    }
  }
  
  draw(ctx: any, baselineY: number, barWidth: number, barSpacing: number, color: string, glowIntensity: number, scale: number) {
    if (!this.peaks) return;
    ctx.save();
    ctx.fillStyle = color;
    
    if (glowIntensity > 0) {
      ctx.shadowBlur = glowIntensity * 4.5 * scale;
      ctx.shadowColor = color;
    }
    
    for (let i = 0; i < this.peaks.length; i++) {
      const x = i * (barWidth + barSpacing) + barSpacing / 2;
      const y = baselineY - this.peaks[i] - 5 * scale;
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, 3 * scale, 1.5 * scale);
      ctx.fill();
    }
    ctx.restore();
  }
}
const wavePeaks = new PeakTrackerSystem();

function drawVignette(ctx: any, width: number, height: number, color: string, intensity: number) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, Math.max(width, height) * 0.45,
    width / 2, height / 2, Math.max(width, height) * 0.8
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, hexToRgba(color, intensity * 0.15));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Audio calculations helper
export interface AudioMetrics {
  bassEnergy: number; // 0 to 1
  trebleEnergy: number; // 0 to 1
  midEnergy: number; // 0 to 1
  allEnergy: number; // 0 to 1
  isBassPeak: boolean;
}

export function analyzeFrequencies(frequencies: Float32Array | Uint8Array): AudioMetrics {
  const len = frequencies.length;
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;
  let allSum = 0;

  const isUint = frequencies instanceof Uint8Array;
  const getVal = (val: number) => (isUint ? val / 255 : val);

  // Index limits based on standard 1024 bin spectrum (FFT 2048 at 44.1kHz)
  const bassEnd = Math.floor(len * 0.03) || 1;
  const midEnd = Math.floor(len * 0.24) || 2;
  const trebleEnd = Math.floor(len * 0.7) || 3;

  for (let i = 0; i < len; i++) {
    const val = getVal(frequencies[i]);
    allSum += val;
    if (i < bassEnd) bassSum += val;
    else if (i < midEnd) midSum += val;
    else if (i < trebleEnd) trebleSum += val;
  }

  let bassEnergy = bassSum / bassEnd;
  let midEnergy = midSum / (midEnd - bassEnd);
  let trebleEnergy = trebleSum / (trebleEnd - midEnd);
  let allEnergy = allSum / len;

  // Apply sensitivity gains to boost physical reactions
  bassEnergy = Math.min(1.0, bassEnergy * 1.55);
  midEnergy = Math.min(1.0, midEnergy * 2.3);
  trebleEnergy = Math.min(1.0, trebleEnergy * 3.2);
  allEnergy = Math.min(1.0, allEnergy * 1.8);

  // Peak detection (using boosted bass energy threshold)
  const isBassPeak = bassEnergy > 0.62;

  return { bassEnergy, trebleEnergy, midEnergy, allEnergy, isBassPeak };
}

/**
 * Draws the selected background on the Canvas
 */
function drawBackground(
  ctx: any,
  width: number,
  height: number,
  config: VisualizerConfig,
  time: number,
  metrics: AudioMetrics
) {
  const { backgroundType, solidColor, gradientStart, gradientEnd, gradientAngle } = config;

  ctx.save();

  if (backgroundType === "solid") {
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, width, height);
  } else if (backgroundType === "gradient" || backgroundType === "animated_gradient") {
    // Determine angle
    let angleRad = (gradientAngle * Math.PI) / 180;
    if (backgroundType === "animated_gradient") {
      angleRad += time * 0.2; // animate gradient angle slowly
    }

    const halfW = width / 2;
    const halfH = height / 2;
    
    // Find gradient coordinates
    const dx = Math.cos(angleRad) * halfW;
    const dy = Math.sin(angleRad) * halfH;

    const grad = ctx.createLinearGradient(
      halfW - dx,
      halfH - dy,
      halfW + dx,
      halfH + dy
    );

    // Pulse slightly to the beat
    const colorShift = metrics.bassEnergy * 15;
    grad.addColorStop(0, gradientStart);
    grad.addColorStop(1, gradientEnd);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (backgroundType === "dark") {
    ctx.fillStyle = "#020204";
    ctx.fillRect(0, 0, width, height);
  } else if (backgroundType === "space" || backgroundType === "abstract") {
    // Cosmic Nebula style
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      10,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );

    // Dynamic coloring based on visualizer settings
    const baseColor1 = config.primaryColor;
    const baseColor2 = config.secondaryColor;

    grad.addColorStop(0, "#080614");
    grad.addColorStop(0.3, "#04030a");
    grad.addColorStop(0.7, "#020105");
    grad.addColorStop(1, "#000000");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Nebula glow effects
    ctx.globalCompositeOperation = "screen";
    
    const nebulaGlow = ctx.createRadialGradient(
      width / 2 + Math.sin(time * 0.1) * 100,
      height / 2 + Math.cos(time * 0.08) * 80,
      50,
      width / 2,
      height / 2,
      width * 0.6
    );
    nebulaGlow.addColorStop(0, hexToRgba(baseColor1, 0.08 + metrics.bassEnergy * 0.05));
    nebulaGlow.addColorStop(0.6, hexToRgba(baseColor2, 0.03 + metrics.trebleEnergy * 0.03));
    nebulaGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebulaGlow;
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = "source-over";
  } else if (backgroundType === "blurred") {
    // Render blurred space/nebula background
    ctx.fillStyle = "#0c0a1a";
    ctx.fillRect(0, 0, width, height);
    
    ctx.save();
    ctx.filter = `blur(120px)`;
    ctx.fillStyle = hexToRgba(config.primaryColor, 0.25);
    ctx.beginPath();
    ctx.arc(
      width / 3 + Math.sin(time * 0.2) * 50,
      height / 2 + Math.cos(time * 0.15) * 50,
      width / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = hexToRgba(config.secondaryColor, 0.25);
    ctx.beginPath();
    ctx.arc(
      (width * 2) / 3 + Math.cos(time * 0.2) * 50,
      height / 2 + Math.sin(time * 0.15) * 50,
      width / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Main Renderer Loop entry point
 */
export function renderVisualizer(
  ctx: any,
  width: number,
  height: number,
  time: number, // in seconds
  frequencies: Float32Array | Uint8Array,
  config: VisualizerConfig
) {
  let dt = time - lastTime;
  if (dt <= 0 || dt > 0.1) {
    dt = 1 / 60;
  }
  dtScale = dt * 60;
  lastTime = time;

  const metrics = analyzeFrequencies(frequencies);

  // Trigger explosions on heavy bass peaks in galaxy mode
  if (config.style === "galaxy" && metrics.isBassPeak) {
    particleSystem.triggerExplosion(8, width, height);
  }

  // Update particles
  particleSystem.update(config.particleAmount, width, height, config.style, metrics.bassEnergy);

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  // Apply Camera Shake on Bass Drop (scaled)
  const scale = Math.min(width, height) / 1080;
  ctx.save();
  let shakeX = 0;
  let shakeY = 0;
  if (config.style === "ncs" && metrics.bassEnergy > 0.75) {
    const shakeIntensity = (metrics.bassEnergy - 0.75) * 45 * scale; // dynamic boost
    shakeX = (Math.random() - 0.5) * shakeIntensity;
    shakeY = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(shakeX, shakeY);
  }

  // 1. Draw Background
  drawBackground(ctx, width, height, config, time, metrics);

  // Draw Vignette pulse flash on beats
  if (metrics.bassEnergy > 0.45) {
    drawVignette(ctx, width, height, config.primaryColor, (metrics.bassEnergy - 0.45) * 1.6);
  }

  // 2. Draw Particles
  drawParticles(ctx, config, width, height, metrics);

  // 3. Draw Visualizer Styles
  if (config.style === "ncs") {
    drawNCSStyle(ctx, width, height, frequencies, config, metrics, time);
  } else if (config.style === "wave") {
    drawWaveStyle(ctx, width, height, frequencies, config, metrics, time);
  } else if (config.style === "galaxy") {
    drawGalaxyStyle(ctx, width, height, frequencies, config, metrics, time);
  } else if (config.style === "lyrics") {
    drawLyricsStyle(ctx, width, height, frequencies, config, metrics, time);
  }

  ctx.restore(); // restores camera shake
}

/**
 * Draws particles depending on selected colors
 */
function drawParticles(
  ctx: any,
  config: VisualizerConfig,
  width: number,
  height: number,
  metrics: AudioMetrics
) {
  const scale = Math.min(width, height) / 1080;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const p of particleSystem.particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2);
    
    let color = p.color;
    if (color === "primary") color = config.primaryColor;
    else if (color === "secondary") color = config.secondaryColor;

    ctx.fillStyle = hexToRgba(color, p.alpha);
    
    // Add light glow to particles if intensity is high
    if (config.glowIntensity > 2) {
      ctx.shadowBlur = config.glowIntensity * 1.5 * scale;
      ctx.shadowColor = color;
    }
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw Style 1: NCS Style (Circle visualizer)
 */
function drawNCSStyle(
  ctx: any,
  width: number,
  height: number,
  frequencies: Float32Array | Uint8Array,
  config: VisualizerConfig,
  metrics: AudioMetrics,
  time: number
) {
  const scale = Math.min(width, height) / 1080;
  const cx = width / 2;
  const cy = height / 2;

  // Bass expands circle (scaled)
  const baseRadius = config.circleSize * scale;
  const expandedRadius = baseRadius + metrics.bassEnergy * 85 * scale;

  // Update Shockwaves
  ncsShockwaves.update(metrics.isBassPeak, expandedRadius, scale);

  // Dynamic Color Blending based on bass beat energy
  const currentPrimary = blendHexColors(config.primaryColor, config.secondaryColor, metrics.bassEnergy);

  ctx.save();

  // Create Glow effect using dynamic color
  if (config.glowIntensity > 0) {
    ctx.shadowBlur = config.glowIntensity * 7 * scale;
    ctx.shadowColor = currentPrimary;
  }

  // Draw audio spectrum wrapping around the circle
  const numBars = 120;
  const maxBarLength = 220 * scale; // boosted bar length
  const angleStep = Math.PI / numBars;

  const isUint = frequencies instanceof Uint8Array;
  const getVal = (idx: number) => {
    if (idx >= frequencies.length) return 0;
    const val = frequencies[idx];
    const norm = isUint ? (val as number) / 255 : (val as number);
    
    // Apply gain curve to boost treble & mid response
    const progress = idx / frequencies.length;
    const gain = 1.35 + progress * 2.9; // boost up to 4.25x
    return Math.min(1.0, norm * gain);
  };

  // Draw Outer Bars
  ctx.lineWidth = config.thickness * scale;
  ctx.lineCap = "round";

  // Create gradient for bars using dynamic color
  const barGrad = ctx.createRadialGradient(cx, cy, expandedRadius, cx, cy, expandedRadius + maxBarLength);
  barGrad.addColorStop(0, currentPrimary);
  barGrad.addColorStop(1, config.secondaryColor);
  ctx.strokeStyle = barGrad;

  // We split the frequencies and wrap them symmetrically
  for (let i = 0; i < numBars; i++) {
    const logIdx = Math.floor(Math.pow(i / numBars, 1.5) * (frequencies.length * 0.6));
    const rawVal = getVal(logIdx);
    const barLength = rawVal * maxBarLength;

    // Draw in both directions (symmetrically)
    const angles = [
      Math.PI / 2 + i * angleStep, // Right side down
      Math.PI / 2 - i * angleStep, // Left side down
    ];

    for (const angle of angles) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x1 = cx + cos * expandedRadius;
      const y1 = cy + sin * expandedRadius;
      const x2 = cx + cos * (expandedRadius + barLength);
      const y2 = cy + sin * (expandedRadius + barLength);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Draw Center 3D Neon Jelly Sphere Core
  ctx.shadowBlur = 0; // Turn off glow for inner circle to keep it sharp
  
  // Calculate dynamic neon color shifting based on time and bass energy
  const hue = (time * 60 + metrics.bassEnergy * 80) % 360;
  const neonColor1 = `hsl(${hue}, 100%, 60%)`;
  const neonColor2 = `hsl(${(hue + 140) % 360}, 100%, 45%)`;
  
  // Multi-stop 3D radial gradient offset to simulate top-left specular lighting
  const lx = cx - expandedRadius * 0.2;
  const ly = cy - expandedRadius * 0.2;
  const sphereGrad = ctx.createRadialGradient(
    lx, ly, expandedRadius * 0.05,
    cx, cy, expandedRadius
  );
  sphereGrad.addColorStop(0, "#ffffff"); // Specular hotspot reflection
  sphereGrad.addColorStop(0.15, neonColor1); // Neon base color
  sphereGrad.addColorStop(0.65, neonColor2); // Ambient dark shadows
  sphereGrad.addColorStop(0.95, "#020108"); // Rim occlusion
  sphereGrad.addColorStop(1.0, currentPrimary); // Outer neon border glow link

  // Helper to draw organic liquid jelly wobbly path with high-frequency shivering vibration
  const drawWobblyPath = (ctx: any, cx: number, cy: number, radius: number, phase: number, scale: number) => {
    const points = 72;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wobble1 = Math.sin(angle * 4 + phase * 2.8) * 9 * scale;
      const wobble2 = Math.cos(angle * 7 - phase * 4.2) * 6 * scale * (0.2 + metrics.bassEnergy * 1.6);
      const wobble3 = Math.sin(angle * 2 + phase * 1.5) * 4 * scale; // slow shape drift
      // High-frequency vibration shivers on audio beat drop!
      const vibration = Math.sin(angle * 36 + phase * 65) * 2.5 * scale * metrics.bassEnergy;
      const r = radius + wobble1 + wobble2 + wobble3 + vibration;
      
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // 1. Draw Base 3D Sphere wobbly path
  drawWobblyPath(ctx, cx, cy, expandedRadius - 2 * scale, time, scale);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // 2. Draw Translucent Glowing Liquid Layer (Layer 2)
  ctx.save();
  drawWobblyPath(ctx, cx, cy, expandedRadius - 6 * scale, time * 1.3 + 1.0, scale);
  const liquidGrad = ctx.createRadialGradient(
    cx + Math.sin(time * 2) * 15 * scale, cy + Math.cos(time * 2) * 15 * scale, expandedRadius * 0.05,
    cx, cy, expandedRadius * 0.95
  );
  liquidGrad.addColorStop(0, hexToRgba(neonColor1, 0.75));
  liquidGrad.addColorStop(0.4, hexToRgba(neonColor2, 0.45));
  liquidGrad.addColorStop(0.85, "rgba(8, 4, 18, 0.05)");
  liquidGrad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = liquidGrad;
  ctx.fill();
  ctx.restore();

  // 3. Draw Specular Gloss Highlight Sheen Overlay
  ctx.save();
  const sx = cx - expandedRadius * 0.22 + Math.sin(time) * 4 * scale;
  const sy = cy - expandedRadius * 0.22 + Math.cos(time) * 4 * scale;
  const shineGrad = ctx.createRadialGradient(sx, sy, 2 * scale, sx, sy, expandedRadius * 0.22);
  shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  shineGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.arc(sx, sy, expandedRadius * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Draw 3D rotating latitude ellipses inside the clipped wobbly jelly boundary
  ctx.save();
  drawWobblyPath(ctx, cx, cy, expandedRadius - 2 * scale, time, scale);
  ctx.clip();

  // Ellipse strokes glow slightly
  ctx.strokeStyle = hexToRgba("#ffffff", 0.16 + metrics.trebleEnergy * 0.32);
  ctx.lineWidth = 1.0 * scale;

  const latLines = 6;
  for (let i = 1; i < latLines; i++) {
    // Determine latitude offset
    const latOffset = (i / latLines - 0.5) * 2 * (expandedRadius * 0.82);
    const ellipseHeight = Math.sqrt(expandedRadius * expandedRadius - latOffset * latOffset) * 0.32 * (1.0 + metrics.bassEnergy * 0.22);
    const ellipseWidth = Math.sqrt(expandedRadius * expandedRadius - latOffset * latOffset);

    ctx.save();
    ctx.translate(cx, cy + latOffset);
    ctx.rotate(time * 0.25 + metrics.bassEnergy * 0.15); // Orbit spin based on beat drops
    ctx.beginPath();
    ctx.ellipse(0, 0, ellipseWidth, ellipseHeight, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw dynamic sparkling diamond stars inside the wobbly core
  const numSparkles = 24;
  for (let i = 0; i < numSparkles; i++) {
    // Distribute positions procedurally using deterministic trig math
    const angle = i * (Math.PI * 2 / numSparkles) + time * 0.12;
    const distanceMult = 0.12 + ((i * 7) % 10) / 16; 
    const dist = (expandedRadius - 10 * scale) * distanceMult;
    
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    
    // Sparkle fade rates
    const sparklePhase = time * (3.2 + (i % 3) * 1.8) + i;
    const alpha = (Math.sin(sparklePhase) + 1.0) / 2.0; 
    
    // Treble energy scales up sparkles on beat drops
    const scaleFactor = 1.0 + metrics.trebleEnergy * 1.5;
    const size = (1.5 + ((i * 3) % 4)) * scale * scaleFactor;
    
    const color = i % 2 === 0 ? "#ffffff" : neonColor1;
    ctx.fillStyle = hexToRgba(color, alpha * (0.35 + metrics.midEnergy * 0.55));
    
    ctx.save();
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * 2.5 * scale;
      ctx.shadowColor = color;
    }
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Draw Inner Ring Outline (3D Rim Highlight) - matches the wobbly path to look fluid!
  ctx.strokeStyle = currentPrimary;
  ctx.lineWidth = (config.thickness + 1) * scale;
  drawWobblyPath(ctx, cx, cy, expandedRadius, time, scale);
  ctx.stroke();

  // Draw secondary neon sub-circle inside - wobbly as well!
  ctx.save();
  if (config.glowIntensity > 0) {
    ctx.shadowBlur = config.glowIntensity * 5 * scale;
    ctx.shadowColor = neonColor1;
  }
  ctx.strokeStyle = neonColor1;
  ctx.lineWidth = 1.5 * scale;
  drawWobblyPath(ctx, cx, cy, expandedRadius - 12 * scale - metrics.trebleEnergy * 20 * scale, time * 0.8, scale);
  ctx.stroke();
  ctx.restore();

  // Draw expanding shockwave rings
  ncsShockwaves.draw(ctx, cx, cy, config.secondaryColor, config.thickness, scale);

  ctx.restore();
}

/**
 * Draw Style 2: Wave Bars
 */
function drawWaveStyle(
  ctx: any,
  width: number,
  height: number,
  frequencies: Float32Array | Uint8Array,
  config: VisualizerConfig,
  metrics: AudioMetrics,
  time: number
) {
  const scale = Math.min(width, height) / 1080;

  const isUint = frequencies instanceof Uint8Array;
  const getVal = (idx: number) => {
    if (idx >= frequencies.length) return 0;
    const val = frequencies[idx];
    const norm = isUint ? (val as number) / 255 : (val as number);
    
    // Apply gain curve to boost response
    const progress = idx / frequencies.length;
    const gain = 1.35 + progress * 2.9;
    return Math.min(1.0, norm * gain);
  };

  const numBars = Math.min(80, frequencies.length);
  const barWidth = (width / numBars) * 0.85;
  const barSpacing = (width / numBars) * 0.15;
  const maxBarHeight = height * 0.48; // slightly taller
  const baselineY = height * 0.58; 

  ctx.save();

  // Prepare height arrays to reuse in drawing reflections
  const barHeights = new Float32Array(numBars);

  // Draw main spectrum bars (3D cylinders with specular highlights)
  for (let i = 0; i < numBars; i++) {
    const freqIdx = i < numBars / 2 
      ? Math.floor(Math.pow((numBars / 2 - i) / (numBars / 2), 1.3) * (frequencies.length * 0.5))
      : Math.floor(Math.pow((i - numBars / 2) / (numBars / 2), 1.3) * (frequencies.length * 0.5));

    const rawVal = getVal(freqIdx);
    const barHeight = rawVal * maxBarHeight + 5 * scale; 
    barHeights[i] = barHeight;

    const x = i * (barWidth + barSpacing) + barSpacing / 2;
    const y = baselineY - barHeight;

    // Create horizontal 3D cylinder linear gradient
    const barGrad3D = ctx.createLinearGradient(x, 0, x + barWidth, 0);
    const barHue = (time * 30 + i * 4.5 + metrics.bassEnergy * 50) % 360;
    const colBase = `hsl(${barHue}, 100%, 55%)`;
    const colShadow1 = `hsl(${barHue}, 100%, 25%)`;
    const colShadow2 = `hsl(${(barHue + 40) % 360}, 100%, 15%)`;
    
    barGrad3D.addColorStop(0, colShadow2);
    barGrad3D.addColorStop(0.25, colBase);
    barGrad3D.addColorStop(0.5, "#ffffff"); // Specular 3D light cylinder bar
    barGrad3D.addColorStop(0.75, colBase);
    barGrad3D.addColorStop(1.0, colShadow1);

    ctx.save();
    ctx.fillStyle = barGrad3D;
    
    // Draw base rounded cylinder bar
    drawRoundRect(ctx, x, y, barWidth, barHeight, Math.min(barWidth / 2, 10 * scale));
    
    // Draw 3D vertical shine reflection stripe down the left side
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    const specWidth = barWidth * 0.15;
    const specRadius = Math.min(specWidth / 2, 2 * scale);
    ctx.beginPath();
    ctx.roundRect(x + barWidth * 0.12, y + 3 * scale, specWidth, barHeight - 6 * scale, specRadius);
    ctx.fill();
    
    ctx.restore();
  }

  // Draw falling peak dots
  wavePeaks.update(barHeights, scale);
  wavePeaks.draw(ctx, baselineY, barWidth, barSpacing, config.secondaryColor, config.glowIntensity, scale);

  // Draw Baseline neon glowing bar
  ctx.save();
  ctx.strokeStyle = config.primaryColor;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(width, baselineY);
  ctx.stroke();
  ctx.restore();

  // Draw Reflection underneath
  ctx.shadowBlur = 0; // Turn off glow for reflection
  ctx.globalAlpha = 0.35; // Fade opacity

  for (let i = 0; i < numBars; i++) {
    const x = i * (barWidth + barSpacing) + barSpacing / 2;
    const h = barHeights[i];
    const y = baselineY; // starts from baseline and goes down
    
    ctx.save();
    
    // Create reflection 3D horizontal gradient combined with vertical fading alpha!
    const barHue = (time * 30 + i * 4.5 + metrics.bassEnergy * 50) % 360;
    const colBase = `hsl(${barHue}, 100%, 50%)`;
    
    const refGrad = ctx.createLinearGradient(x, 0, x + barWidth, 0);
    refGrad.addColorStop(0, hexToRgba(colBase, 0.15));
    refGrad.addColorStop(0.5, "rgba(255,255,255,0.4)");
    refGrad.addColorStop(1, hexToRgba(colBase, 0.15));

    ctx.fillStyle = refGrad;
    
    // Draw reflection rounded bar
    drawRoundRect(ctx, x, y, barWidth, h * 0.8, Math.min(barWidth / 2, 10 * scale));
    
    // Draw specular reflection stripe down reflection
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(x + barWidth * 0.12, y + 2 * scale, barWidth * 0.15, h * 0.8 - 4 * scale, 1 * scale);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draw Style 3: Galaxy Orb
 */
function drawGalaxyStyle(
  ctx: any,
  width: number,
  height: number,
  frequencies: Float32Array | Uint8Array,
  config: VisualizerConfig,
  metrics: AudioMetrics,
  time: number
) {
  const scale = Math.min(width, height) / 1080;
  const cx = width / 2;
  const cy = height / 2;
  
  const isUint = frequencies instanceof Uint8Array;
  const getVal = (idx: number) => {
    if (idx >= frequencies.length) return 0;
    const val = frequencies[idx];
    const norm = isUint ? (val as number) / 255 : (val as number);
    
    // Apply gain curve
    const progress = idx / frequencies.length;
    const gain = 1.35 + progress * 2.9;
    return Math.min(1.0, norm * gain);
  };

  const orbRadius = config.circleSize * scale;

  ctx.save();

  // Draw ambient cosmic rays / tilted 3D glowing orbital planes
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(cx, cy);
  
  // Concentric orbital rings that ripple and tilt dynamically
  const ringCount = 3;
  for (let r = 0; r < ringCount; r++) {
    const mult = 1.35 + r * 0.5;
    // Radius expands on bass drops
    const currentRingRadius = orbRadius * mult + metrics.bassEnergy * 35 * scale;
    
    // Dynamic HSL neon colors
    const color = r % 2 === 0 ? config.primaryColor : config.secondaryColor;
    
    // Sound-reactive opacity and line thickness
    const opacity = (0.25 + metrics.midEnergy * 0.45) - r * 0.04;
    ctx.strokeStyle = hexToRgba(color, opacity);
    ctx.lineWidth = (config.thickness * 0.8 + metrics.trebleEnergy * 3.5) * scale;
    
    // Sound-reactive shadow glow intensity
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = (config.glowIntensity * 3.5 + metrics.bassEnergy * 15) * scale;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.save();
    // Rotate orbital plane based on index and slow drift time
    ctx.rotate(time * 0.05 * (r % 2 === 0 ? 1 : -1) + r * 1.2);
    
    ctx.beginPath();
    const rx = currentRingRadius;
    const ry = currentRingRadius * 0.28; // Squashed ellipse for 3D Saturn tilt perspective
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw glowing orbital tick dust
    ctx.shadowBlur = 0; // Turn off shadow blur on tick dots to prevent pixelation
    const tickCount = 10 + r * 4;
    for (let t = 0; t < tickCount; t++) {
      const angle = (t / tickCount) * Math.PI * 2 + time * (0.08 * (r + 1));
      const tx = Math.cos(angle) * rx;
      const ty = Math.sin(angle) * ry;
      
      const tickSize = (1.8 + r * 0.8) * scale * (1.0 + metrics.trebleEnergy * 0.8);
      
      // Star tick glows bright white mixed with treble energy
      ctx.fillStyle = hexToRgba("#ffffff", 0.6 + metrics.trebleEnergy * 0.4);
      ctx.beginPath();
      ctx.arc(tx, ty, tickSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  // Draw Outer Spikes/Waves emanating from the Orb
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  if (config.glowIntensity > 0) {
    ctx.shadowBlur = config.glowIntensity * 5 * scale;
    ctx.shadowColor = config.primaryColor;
  }
  ctx.strokeStyle = config.primaryColor;
  ctx.lineWidth = config.thickness * scale;

  const spikeCount = 180;
  const spikeMaxLen = 160 * scale;
  
  ctx.beginPath();
  for (let i = 0; i <= spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    // Map frequency bin logarithmic
    const logIdx = Math.floor(Math.pow(i < spikeCount / 2 ? i / (spikeCount / 2) : (spikeCount - i) / (spikeCount / 2), 1.4) * (frequencies.length * 0.5));
    const rawVal = getVal(logIdx);
    
    // Wave oscillation added to length
    const waveOsc = Math.sin(angle * 8 + time * 5) * 16 * scale * (0.2 + metrics.midEnergy);
    const totalSpikeLen = rawVal * spikeMaxLen + waveOsc + 10 * scale;
    
    const x = cx + Math.cos(angle) * (orbRadius + totalSpikeLen);
    const y = cy + Math.sin(angle) * (orbRadius + totalSpikeLen);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Draw Galaxy Orb Atmosphere (Layered wobbly spheres)
  ctx.save();

  // Dynamic Color Blending based on midrange audio energy
  const currentSecondary = blendHexColors(config.secondaryColor, config.primaryColor, metrics.midEnergy);

  if (config.glowIntensity > 0) {
    ctx.shadowBlur = config.glowIntensity * 9 * scale;
    ctx.shadowColor = currentSecondary;
  }

  // Calculate dynamic neon color shifting for the Galaxy sphere
  const galaxyHue = (time * 50 + metrics.midEnergy * 90) % 360;
  const neonCol1 = `hsl(${galaxyHue}, 100%, 62%)`;
  const neonCol2 = `hsl(${(galaxyHue + 120) % 360}, 100%, 48%)`;

  // 1. Base 3D Radial Sphere Layer
  const baseGrad = ctx.createRadialGradient(
    cx - orbRadius * 0.2, cy - orbRadius * 0.2, orbRadius * 0.05,
    cx, cy, orbRadius
  );
  baseGrad.addColorStop(0, "#ffffff"); // specular shine hotspot
  baseGrad.addColorStop(0.15, neonCol1); // base celestial neon
  baseGrad.addColorStop(0.6, neonCol2); // dark space shadows
  baseGrad.addColorStop(0.92, "#030208"); // edge shade
  baseGrad.addColorStop(1.0, currentSecondary); // dynamic glow ring link

  // Helper to draw organic wobbly celestial path
  const drawCelestialWobble = (ctx: any, radius: number, phase: number) => {
    const points = 60;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wobble1 = Math.sin(angle * 3 + phase * 2.2) * 8 * scale;
      const wobble2 = Math.cos(angle * 5 - phase * 3.4) * 5 * scale * (0.25 + metrics.bassEnergy * 1.4);
      const r = radius + wobble1 + wobble2;
      
      const rx = cx + Math.cos(angle) * r;
      const ry = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
  };

  ctx.fillStyle = baseGrad;
  drawCelestialWobble(ctx, orbRadius, time);
  ctx.fill();

  // Draw 3D star storm orbiting inside the wobbly celestial core
  ctx.save();
  drawCelestialWobble(ctx, orbRadius - 2 * scale, time);
  ctx.clip();
  
  const starCount = 35;
  for (let i = 0; i < starCount; i++) {
    // Math model: particles orbit on tilted planes in 3D space
    const orbitalProgress = time * 0.6 + i * (Math.PI * 2 / starCount);
    const z = Math.sin(orbitalProgress); // depth value [-1 to 1]
    const orbitR = orbRadius * 0.65 * (1.1 + Math.cos(orbitalProgress * 2) * 0.25);
    
    // Tilted coordinates
    const rx = cx + Math.cos(orbitalProgress) * orbitR * 0.95;
    const ry = cy + Math.sin(orbitalProgress * 0.6 + i * 0.1) * orbRadius * 0.45;
    
    // Scale size and opacity based on z-depth (larger/brighter when close to viewer!)
    const size = (1.5 + (z + 1.0) * 2.8) * scale * (1.0 + metrics.trebleEnergy * 0.6);
    const opacity = (0.18 + (z + 1.0) * 0.42) * (0.35 + metrics.midEnergy * 0.65);
    
    const starColor = blendHexColors(config.primaryColor, config.secondaryColor, (z + 1.0) / 2.0);
    ctx.fillStyle = hexToRgba(starColor, opacity);
    
    ctx.beginPath();
    ctx.arc(rx, ry, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();



  ctx.restore();
  ctx.restore();
}

/**
 * Utility: Hex color code to RGBA string helper
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  let cleanHex = hex.replace("#", "");

  // Expand shorthand e.g. "03F" to "0033FF"
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRoundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (height < 0) return; // avoid drawing negative heights
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

export interface LyricLine {
  time: number;
  text: string;
}

export function parseLRC(lrcText: string, songDuration: number): LyricLine[] {
  const lines = lrcText.split("\n");
  const parsed: LyricLine[] = [];
  
  // Regex to match standard LRC timestamps like [01:23.45]
  const timestampRegex = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = timestampRegex.exec(trimmed);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const centi = parseInt(match[3], 10);
      const text = match[4].trim();
      
      const time = min * 60 + sec + centi / 100;
      parsed.push({ time, text });
    }
  }
  
  // Fallback: If no timestamps were matched, spread lines evenly across duration
  if (parsed.length === 0) {
    const rawLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (rawLines.length > 0) {
      const durationVal = songDuration > 0 ? songDuration : 180;
      const step = durationVal / (rawLines.length + 1);
      for (let i = 0; i < rawLines.length; i++) {
        parsed.push({
          time: step * (i + 1),
          text: rawLines[i],
        });
      }
    }
  }
  
  return parsed.sort((a, b) => a.time - b.time);
}

function drawLyricsStyle(
  ctx: any,
  width: number,
  height: number,
  frequencies: Float32Array | Uint8Array,
  config: VisualizerConfig,
  metrics: AudioMetrics,
  time: number
) {
  const scale = Math.min(width, height) / 1080;
  const cx = width / 2;
  const cy = height / 2;

  // 1. Draw blurred pulsing nebula center glow
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const radiusPulse = 300 * scale * (1.0 + metrics.bassEnergy * 0.16);
  const nebGrad = ctx.createRadialGradient(cx, cy, 10 * scale, cx, cy, radiusPulse);
  nebGrad.addColorStop(0, hexToRgba(config.primaryColor, 0.28));
  nebGrad.addColorStop(0.5, hexToRgba(config.secondaryColor, 0.14));
  nebGrad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = nebGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPulse * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Draw circular reactive waveform ringing around lyrics
  ctx.save();
  ctx.strokeStyle = hexToRgba(config.primaryColor, 0.28);
  ctx.lineWidth = 1.8 * scale;
  
  if (config.glowIntensity > 0) {
    ctx.shadowBlur = config.glowIntensity * 2 * scale;
    ctx.shadowColor = config.primaryColor;
  }
  
  ctx.beginPath();
  const numPoints = 120;
  const outerR = 340 * scale + metrics.bassEnergy * 15 * scale;
  const isUint = frequencies instanceof Uint8Array;
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2 + time * 0.04;
    // Mirrored spectrum indices
    const normalizedAngle = Math.abs(Math.sin(angle));
    const freqIdx = Math.floor(Math.pow(normalizedAngle, 1.6) * (frequencies.length * 0.45));
    
    const rawVal = isUint ? (frequencies[freqIdx] as number) / 255 : (frequencies[freqIdx] as number);
    // Apply progressive gain curve
    const gain = 1.3 + (freqIdx / frequencies.length) * 2.5;
    const val = Math.min(1.0, rawVal * gain);
    
    const r = outerR + val * 55 * scale;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Parse and render progressive lyrics using track duration and sync offset
  const lyricsText = config.lyrics || "";
  const duration = config.audioDuration || 180;
  const lyricLines = parseLRC(lyricsText, duration);
  
  // Apply synchronization delay offset slider adjustment
  const adjustedTime = time + (config.lyricsOffset || 0);

  // Find active lyric index
  let activeIdx = -1;
  for (let i = 0; i < lyricLines.length; i++) {
    if (adjustedTime >= lyricLines[i].time) {
      activeIdx = i;
    }
  }

  // Draw previous line (faded, above)
  if (activeIdx > 0) {
    ctx.save();
    ctx.font = `italic 600 ${28 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = hexToRgba(config.secondaryColor, 0.38);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lyricLines[activeIdx - 1].text, cx, cy - 85 * scale);
    ctx.restore();
  }

  // Draw current line (large, neon glowing, slide-in/fade-in animation)
  if (activeIdx >= 0 && activeIdx < lyricLines.length) {
    const currentLine = lyricLines[activeIdx];
    
    // Smooth transition progress
    const elapsed = adjustedTime - currentLine.time;
    const transitionTime = 0.45; // seconds
    const progress = Math.min(1.0, elapsed / transitionTime);
    
    // Slide up + scale up + fade in
    const slideOffset = (1.0 - progress) * 16 * scale;
    const scaleFactor = 0.94 + progress * 0.06;
    const alpha = progress;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${52 * scale}px system-ui, -apple-system, sans-serif`;
    
    // Base coordinates
    const ty = cy + slideOffset;
    
    // Metallic dynamic gradient fill
    const textGrad = ctx.createLinearGradient(cx - 240 * scale, 0, cx + 240 * scale, 0);
    const textHue = (time * 45 + metrics.midEnergy * 65) % 360;
    const col1 = `hsl(${textHue}, 100%, 75%)`;
    const col2 = `hsl(${(textHue + 120) % 360}, 100%, 65%)`;
    
    textGrad.addColorStop(0, hexToRgba(col1, alpha));
    textGrad.addColorStop(0.5, hexToRgba("#ffffff", alpha)); // shine highlight
    textGrad.addColorStop(1.0, hexToRgba(col2, alpha));

    ctx.fillStyle = textGrad;

    // Glowing drop shadow
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * 6 * scale;
      ctx.shadowColor = blendHexColors(config.primaryColor, config.secondaryColor, metrics.bassEnergy);
    }
    
    // Apply 3D scale and slide transformation
    ctx.translate(cx, ty);
    ctx.scale(scaleFactor, scaleFactor);
    
    ctx.fillText(currentLine.text, 0, 0);
    ctx.restore();
  } else {
    // Show startup title if song has not reached timestamps
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${56 * scale}px system-ui, -apple-system, sans-serif`;
    
    const textHue = (time * 30) % 360;
    ctx.fillStyle = `hsl(${textHue}, 100%, 80%)`;
    
    if (config.glowIntensity > 0) {
      ctx.shadowBlur = config.glowIntensity * 5 * scale;
      ctx.shadowColor = config.primaryColor;
    }
    ctx.fillText("BeatCanvas Lyrical Video", cx, cy);
    ctx.restore();
  }

  // Draw next line (faded, below)
  if (activeIdx + 1 < lyricLines.length) {
    ctx.save();
    ctx.font = `italic 600 ${28 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = hexToRgba(config.primaryColor, 0.38);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lyricLines[activeIdx + 1].text, cx, cy + 95 * scale);
    ctx.restore();
  }
}
