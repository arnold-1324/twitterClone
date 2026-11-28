import santaCostume from "../assets/call/santa-costume.webp";
import winterVillage from "../assets/call/winter-village.webp";
import witchHat from "../assets/call/halloween-hat.webp";
import halloweenWoodland from "../assets/call/halloween-scene.webp";
import partyHeadband from "../assets/call/new-year-hat.webp";
import newYearTerrace from "../assets/call/new-year-scene.webp";
import doomsdayVisor from "../assets/call/doomsday-visor.webp";
import doomsdaySkyline from "../assets/call/doomsday-scene.webp";

// Regions in the transparent costume image and the brim/mouth attachment points within them.
const hat = { x: 212, y: 0, width: 936, height: 563, anchorX: 351, anchorY: 513 };
const beard = { x: 243, y: 597, width: 720, height: 657, anchorX: 373, anchorY: 149 };
const effects = {
  santa: { costume: santaCostume, background: winterVillage, tint: "rgba(78, 113, 162, 0.06)" },
  halloween: { costume: witchHat, background: halloweenWoodland, tint: "rgba(143, 92, 146, 0.09)" },
  newYear: { costume: partyHeadband, background: newYearTerrace, tint: "rgba(180, 130, 71, 0.07)" },
  doomsday: { costume: doomsdayVisor, background: doomsdaySkyline, tint: "rgba(57, 168, 124, 0.12)" },
};
const headpieces = {
  halloween: { width: 1.64, anchor: 0.88, offset: 0.08 },
  newYear: { width: 1.26, anchor: 0.52, offset: -0.02 },
  doomsday: { width: 1.20, anchor: 0.75, offset: 0.12 },
};

async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export async function loadEffectArtwork(name) {
  const theme = effects[name];
  if (!theme) throw new Error("Unknown video filter.");
  const [costume, background] = await Promise.all([loadImage(theme.costume), loadImage(theme.background)]);
  return { name, costume, background, tint: theme.tint };
}

export function drawBackdrop(ctx, picture, width, height) {
  const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
  const imageWidth = picture.naturalWidth * scale;
  const imageHeight = picture.naturalHeight * scale;
  ctx.drawImage(picture, (width - imageWidth) / 2, (height - imageHeight) * 0.46, imageWidth, imageHeight);
}

export function trackFace(landmarks, width, height, previous) {
  if (!landmarks) return undefined;
  function point(index) {
    const { x, y } = landmarks[index];
    return { x: x * width, y: y * height };
  }
  const left = point(234);
  const right = point(454);
  const faceWidth = Math.hypot(right.x - left.x, right.y - left.y);
  if (faceWidth < 18) return undefined;

  const forehead = point(10);
  const chin = point(152);
  const upperLip = point(13);
  const lowerLip = point(14);
  const mouthX = (upperLip.x + lowerLip.x) / 2;
  const mouthY = (upperLip.y + lowerLip.y) / 2;
  const neckLength = Math.hypot(chin.x - mouthX, chin.y - mouthY);
  const next = {
    brimX: forehead.x, brimY: forehead.y, mouthX, mouthY, faceWidth,
    beardHeight: Math.min(faceWidth * 0.98, (neckLength + faceWidth * 0.36) / 0.77),
    angle: Math.atan2(right.y - left.y, right.x - left.x),
  };
  if (!previous) return next;
  const movement = Math.hypot(next.mouthX - previous.mouthX, next.mouthY - previous.mouthY) / faceWidth;
  const follow = movement > 0.1 ? 0.86 : 0.59;
  for (const dimension of Object.keys(next)) {
    next[dimension] = previous[dimension] + (next[dimension] - previous[dimension]) * follow;
  }
  return next;
}

function fitPiece(ctx, artwork, piece, anchorX, anchorY, width, height, angle) {
  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.rotate(angle);
  ctx.drawImage(artwork, piece.x, piece.y, piece.width, piece.height,
    -width * piece.anchorX / piece.width, -height * piece.anchorY / piece.height, width, height);
  ctx.restore();
}

export function drawCostume(ctx, artwork, pose) {
  if (!pose) return;
  const { costume, name } = artwork;
  const { angle, brimX, brimY, mouthX, mouthY, faceWidth, beardHeight } = pose;
  const headpiece = headpieces[name];
  if (headpiece) {
    const width = faceWidth * headpiece.width;
    const height = width * costume.naturalHeight / costume.naturalWidth;
    const piece = {
      x: 0, y: 0, width: costume.naturalWidth, height: costume.naturalHeight,
      anchorX: costume.naturalWidth * 0.5, anchorY: costume.naturalHeight * headpiece.anchor,
    };
    fitPiece(ctx, costume, piece, brimX, brimY + faceWidth * headpiece.offset, width, height, angle);
    return;
  }
  const hatScale = faceWidth * 1.1 / 690;
  fitPiece(ctx, costume, hat, brimX, brimY + faceWidth * 0.09,
    hat.width * hatScale, hat.height * hatScale, angle);
  fitPiece(ctx, costume, beard, mouthX, mouthY, faceWidth * 1.01, beardHeight, angle);
}

export function drawParticles(ctx, name, width, height, seconds) {
  ctx.save();
  const count = name === "santa" ? 30 : 20;
  for (let i = 0; i < count; i++) {
    const x = ((i * 0.61803 + seconds * 0.005) % 1) * width + Math.sin(i + seconds * 0.7) * 7;
    const progress = (i * 0.367 + seconds * (0.035 + i % 5 * 0.014)) % 1;
    const y = (name === "halloween" || name === "doomsday" ? 1 - progress : progress) * height;
    ctx.globalAlpha = 0.22 + i % 4 * 0.13;
    if (name === "newYear") {
      ctx.fillStyle = i % 3 === 0 ? "#e6e8f5" : "#f7cd73";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(seconds * 0.8 + i);
      ctx.fillRect(-1.3, -1.8, 2.6, 3.6);
      ctx.restore();
      continue;
    }
    if (name === "halloween") ctx.fillStyle = i % 3 === 0 ? "#b29dec" : "#ffb764";
    else if (name === "doomsday") ctx.fillStyle = i % 3 === 0 ? "#ecd9a9" : "#79ffbc";
    else ctx.fillStyle = "#f4f8ff";
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + i % 4 * 0.54, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
