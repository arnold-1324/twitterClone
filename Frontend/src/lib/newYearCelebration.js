const bursts = [
  { x: 0.21, y: 0.29, time: 0.62, size: 0.25, color: "#ffcd76" },
  { x: 0.79, y: 0.24, time: 1.17, size: 0.27, color: "#f4d9ff" },
  { x: 0.70, y: 0.42, time: 1.77, size: 0.20, color: "#ffb395" },
];
const burstDuration = 1.2;
const revealTime = bursts.at(-1).time + burstDuration;

function drawRocket(ctx, x, y, startY, flight) {
  const tip = startY + (y - startY) * flight;
  const trail = Math.min(startY - tip, (startY - y) * 0.18);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "#ffe6b4";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, tip);
  ctx.lineTo(x + 2, tip + trail);
  ctx.stroke();
}

export function drawFireworks(ctx, width, height, elapsed) {
  if (elapsed >= revealTime) return;
  const scale = Math.min(width, height);
  ctx.save();
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "screen";
  for (const burst of bursts) {
    const age = elapsed - burst.time;
    if (age < -0.55 || age >= burstDuration) continue;
    const x = burst.x * width;
    const y = burst.y * height;
    if (age < 0) {
      drawRocket(ctx, x, y, height * 0.79, 1 + age / 0.55);
      continue;
    }
    const previous = Math.max(0, age - 0.11);
    const travel = 1 - Math.exp(-2.9 * age);
    const previousTravel = 1 - Math.exp(-2.9 * previous);
    const fall = scale * 0.10 * age ** 2;
    const previousFall = scale * 0.10 * previous ** 2;
    const fade = 1 - age / burstDuration;
    ctx.lineWidth = Math.max(1, scale * 0.004);
    for (let i = 0; i < 38; i++) {
      const angle = i * 2.399963 + burst.time;
      const reach = scale * burst.size * (0.53 + (i * 13 % 37) / 75);
      const vx = Math.cos(angle) * reach;
      const vy = Math.sin(angle) * reach;
      ctx.globalAlpha = fade * (0.55 + (i % 5) * 0.10);
      ctx.strokeStyle = i % 5 === 0 ? "#fff5dc" : burst.color;
      ctx.beginPath();
      ctx.moveTo(x + vx * previousTravel, y + vy * previousTravel + previousFall);
      ctx.lineTo(x + vx * travel, y + vy * travel + fall);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawUpcomingYear(ctx, width, height, elapsed, year) {
  if (elapsed < revealTime) return;
  const opacity = Math.min(1, (elapsed - revealTime) / 0.55);
  const size = Math.min(width * 0.22, height * 0.18, 82);
  const y = height * 0.83 + (1 - opacity) * size * 0.14;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#20132a";
  ctx.lineWidth = Math.max(2, size * 0.075);
  ctx.shadowColor = "rgba(10, 5, 22, 0.65)";
  ctx.shadowBlur = size * 0.23;
  ctx.strokeText(year, width / 2, y);
  ctx.shadowBlur = 0;
  const gold = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  gold.addColorStop(0, "#fff9e6");
  gold.addColorStop(0.55, "#ffe6a1");
  gold.addColorStop(1, "#e8aa58");
  ctx.fillStyle = gold;
  ctx.fillText(year, width / 2, y);
  ctx.restore();
}
