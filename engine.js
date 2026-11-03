// Motion model shared by the canvas preview, GIF frames, and SVG export.
// Looping motions are periodic: t=0 and t=1 draw the same picture, so a
// slideshow that ignores GIF loop counts still looks intentional.

export const FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", sans-serif';

export const PALETTES = [
  {
    id: "ink",
    name: "墨色",
    bg: "#f3f5f7",
    colors: ["#17324d", "#0e6b68", "#b5472a", "#8a5a12", "#315c2b"],
  },
  {
    id: "night",
    name: "深底",
    bg: "#172033",
    colors: ["#f4efe6", "#8ecae6", "#f2b56b", "#e07a5f", "#95d5b2"],
  },
  {
    id: "sea",
    name: "海蓝",
    bg: "#f3f7fb",
    colors: ["#0b3a66", "#1d6a9a", "#0f6e6b", "#b8612d", "#3d4f73"],
  },
  {
    id: "mono",
    name: "单色蓝",
    bg: "#ffffff",
    colors: ["#14375f", "#1d4e89", "#0e2f57", "#245a96", "#102844"],
  },
];

export const MOTIONS = [
  {
    id: "scroll",
    name: "滚动词云",
    dirs: [
      ["up", "向上"],
      ["down", "向下"],
      ["left", "向左"],
      ["right", "向右"],
    ],
    hint: "整团词云朝一个方向循环滚出，另一侧再进入。",
  },
  {
    id: "pass",
    name: "穿行",
    dirs: [
      ["left", "向左"],
      ["right", "向右"],
      ["up", "向上"],
      ["down", "向下"],
    ],
    hint: "词语沿同一方向穿过。部分词一轮走两屏，速度不同。",
  },
  {
    id: "orbit",
    name: "3D旋转",
    dirs: [
      ["cw", "顺时针"],
      ["ccw", "逆时针"],
    ],
    hint: "词语铺在球面上转动。平面形状对这个动画不起作用。",
  },
  {
    id: "spin",
    name: "平面旋转",
    dirs: [
      ["cw", "顺时针"],
      ["ccw", "逆时针"],
    ],
    hint: "词云绕中心转一圈，文字保持水平。",
  },
  {
    id: "wave",
    name: "波浪",
    dirs: [
      ["horizontal", "横向"],
      ["vertical", "纵向"],
    ],
    hint: "词语沿波浪起伏，一轮后回到原位。",
  },
  {
    id: "float",
    name: "漂浮",
    dirs: [],
    hint: "每个词按自己的节拍上下浮动。",
  },
  {
    id: "pulse",
    name: "呼吸",
    dirs: [],
    hint: "整团词云缓慢放大，再回到原尺寸。",
  },
  {
    id: "sweep",
    name: "扫描",
    dirs: [
      ["right", "向右"],
      ["left", "向左"],
      ["down", "向下"],
      ["up", "向上"],
    ],
    hint: "一道高亮扫过词云，扫完从另一侧接上。",
  },
  {
    id: "burst",
    name: "散开重组",
    dirs: [],
    hint: "向外散开后回到原来的位置。",
  },
  {
    id: "flash",
    name: "逐词点亮",
    dirs: [
      ["forward", "正向"],
      ["reverse", "反向"],
    ],
    hint: "词语轮流变亮，位置不变。",
  },
];

export const SHAPES = [
  ["cloud", "云朵"],
  ["ellipse", "椭圆"],
  ["circle", "圆形"],
  ["rect", "矩形"],
  ["diamond", "菱形"],
  ["heart", "心形"],
];

export const MAX_WORDS = 48;

export function motionById(id) {
  return MOTIONS.find((item) => item.id === id) || MOTIONS[0];
}

export function parseWords(source) {
  const weights = new Map();
  const order = [];
  const add = (raw, weight) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return;
    const clipped = [...text].slice(0, 18).join("");
    const amount = Number.isFinite(weight) && weight > 0 ? weight : 1;
    if (!weights.has(clipped)) order.push(clipped);
    weights.set(clipped, (weights.get(clipped) || 0) + amount);
  };

  const addToken = (raw) => {
    const token = raw.trim();
    if (!token || token.startsWith("#")) return;
    const weighted = token.match(/^(.+?)[\s:：\t]+(\d+(?:\.\d+)?)$/);
    if (weighted && [...weighted[1].trim()].length <= 18) {
      add(weighted[1], Number(weighted[2]));
      return;
    }
    add(token, 1);
  };

  for (const line of String(source || "").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/[、，,;；]/.test(trimmed)) {
      for (const part of trimmed.split(/[、，,;；]+/)) addToken(part);
      continue;
    }
    addToken(trimmed);
  }

  return order.map((text) => ({ text, weight: weights.get(text) }));
}

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fract(value) {
  return value - Math.floor(value);
}

export function inShape(shape, x, y, width, height) {
  const nx = (x - width / 2) / (width / 2);
  const ny = (y - height / 2) / (height / 2);
  if (x < 10 || y < 10 || x > width - 10 || y > height - 10) return false;
  if (shape === "rect") return Math.abs(nx) <= 0.9 && Math.abs(ny) <= 0.84;
  if (shape === "circle") {
    const rx = nx / 0.78;
    const ry = ny / 0.86;
    return rx * rx + ry * ry <= 1;
  }
  if (shape === "diamond") return Math.abs(nx) / 0.9 + Math.abs(ny) / 0.82 <= 1;
  if (shape === "heart") {
    const hx = nx / 0.72;
    const hy = -ny / 0.72 + 0.15;
    const a = hx * hx + hy * hy - 1;
    return a * a * a - hx * hx * hy * hy * hy <= 0;
  }
  if (shape === "cloud") {
    const ang = Math.atan2(ny / 0.72, nx / 0.9);
    const wobble = 1 + 0.07 * Math.sin(ang * 3) + 0.045 * Math.sin(ang * 5 + 0.6);
    return (nx / 0.9) ** 2 + (ny / 0.72) ** 2 <= wobble * wobble;
  }
  return (nx / 0.92) ** 2 + (ny / 0.78) ** 2 <= 1;
}

function shapeFits(shape, x, y, hw, hh, width, height) {
  const points = [
    [x, y],
    [x - hw * 0.75, y],
    [x + hw * 0.75, y],
    [x, y - hh * 0.65],
    [x, y + hh * 0.65],
  ];
  let hits = 0;
  for (const [px, py] of points) {
    if (inShape(shape, px, py, width, height)) hits += 1;
  }
  return hits >= 4;
}

function overlaps(a, b, gap) {
  return (
    Math.abs(a.x - b.x) < a.hw + b.hw + gap &&
    Math.abs(a.y - b.y) < a.hh + b.hh + gap
  );
}

function spherePoint(index, count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * index;
  return { theta, phi: Math.asin(clamp(y, -1, 1)), ring };
}

export function layoutWords(items, options) {
  const {
    width,
    height,
    shape,
    gap,
    minSize,
    maxSize,
    mixedAngle,
    seed,
    palette,
    measure,
  } = options;
  const rng = mulberry32(seed);
  const ranked = [...items]
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text, "zh"))
    .slice(0, MAX_WORDS);
  if (!ranked.length) return [];

  const maxWeight = ranked[0].weight;
  const minWeight = ranked[ranked.length - 1].weight;
  const placed = [];

  ranked.forEach((item, index) => {
    const span = maxWeight === minWeight ? 1 : (item.weight - minWeight) / (maxWeight - minWeight);
    let size = minSize + (maxSize - minSize) * span ** 0.62;
    const vertical = mixedAngle && index > 0 && rng() < 0.28 && [...item.text].length <= 6;
    let box = null;
    for (let attempt = 0; attempt < 7 && !box; attempt += 1) {
      const metrics = measure(item.text, size);
      const hw = metrics.width / 2 + 3;
      const hh = size * 0.56;
      const candidate = findSpot({
        width,
        height,
        shape,
        gap,
        hw: vertical ? hh : hw,
        hh: vertical ? hw : hh,
        rng,
        placed,
      });
      if (candidate) {
        box = { ...candidate, hw: vertical ? hh : hw, hh: vertical ? hw : hh, size };
      } else {
        size = Math.max(minSize, size * 0.86);
      }
    }
    if (!box) return;
    const sphere = spherePoint(index, ranked.length);
    placed.push({
      id: index,
      text: item.text,
      weight: item.weight,
      x: box.x,
      y: box.y,
      size: box.size,
      hw: box.hw,
      hh: box.hh,
      rotate: vertical ? -Math.PI / 2 : 0,
      color: palette[index % palette.length],
      phase: rng(),
      loops: index % 4 === 0 ? 2 : 1,
      theta: sphere.theta,
      phi: sphere.phi,
    });
  });
  return placed;
}

function findSpot({ width, height, shape, gap, hw, hh, rng, placed }) {
  const cx = width / 2;
  const cy = height / 2;
  let angle = rng() * Math.PI * 2;
  let radius = 0;
  for (let step = 0; step < 2800; step += 1) {
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * (height / width);
    const spot = { x, y, hw, hh };
    if (
      shapeFits(shape, x, y, hw, hh, width, height) &&
      placed.every((other) => !overlaps(spot, other, gap))
    ) {
      return spot;
    }
    angle += 0.42;
    radius += 1.15;
  }
  return null;
}

function signFor(direction) {
  if (direction === "down" || direction === "right" || direction === "cw" || direction === "forward") {
    return 1;
  }
  return -1;
}

function itemFrom(word, patch) {
  return {
    id: word.id,
    text: word.text,
    color: word.color,
    rotate: word.rotate,
    x: word.x,
    y: word.y,
    size: word.size,
    opacity: 1,
    z: 0,
    ...patch,
  };
}

function axisCopies(base, t, span, sign, loops) {
  // Copies sit one stage apart and travel an integer number of stages.
  // The index window is wide enough that one cycle only reorders them, so
  // the clipped picture at t=0 matches t=1 even when a glyph crosses the edge.
  const shift = sign * t * span * loops;
  const copies = [];
  for (let i = -1; i <= loops + 1; i += 1) {
    copies.push({ i, coord: base + shift - sign * span * i });
  }
  return copies;
}

export function frameItems(words, t, params) {
  const { width, height, motion, direction, amplitude } = params;
  const time = t === 1 ? 1 : fract(t);
  const items = [];
  const amp = clamp(amplitude, 0.25, 2);

  if (motion === "orbit") {
    const sign = direction === "ccw" ? -1 : 1;
    const radius = Math.min(width, height) * 0.36 * clamp(amp, 0.55, 1.6);
    for (const word of words) {
      const ang = word.theta + sign * time * Math.PI * 2;
      const x3 = Math.cos(ang) * Math.cos(word.phi);
      const y3 = Math.sin(word.phi);
      const z3 = Math.sin(ang) * Math.cos(word.phi);
      const persp = 1.65 / (1.65 + z3);
      items.push(
        itemFrom(word, {
          x: width / 2 + x3 * radius * persp * (width > height ? 1.2 : 1),
          y: height / 2 + y3 * radius * 0.86 * persp,
          size: word.size * (0.58 + 0.55 * persp),
          opacity: 0.3 + 0.7 * ((z3 + 1) / 2),
          z: z3,
          rotate: 0,
        }),
      );
    }
    items.sort((a, b) => a.z - b.z);
    return items;
  }

  for (const word of words) {
    if (motion === "scroll" || motion === "pass") {
      const vertical = direction === "up" || direction === "down";
      const span = vertical ? height : width;
      const sign = signFor(direction);
      const loops = motion === "pass" ? word.loops : 1;
      const coords = axisCopies(vertical ? word.y : word.x, time, span, sign, loops);
      for (const copy of coords) {
        items.push(
          itemFrom(word, {
            id: `${word.id}:${copy.i}`,
            x: vertical ? word.x : copy.coord,
            y: vertical ? copy.coord : word.y,
          }),
        );
      }
      continue;
    }

    if (motion === "spin") {
      const ang = (direction === "ccw" ? -1 : 1) * time * Math.PI * 2;
      const dx = word.x - width / 2;
      const dy = word.y - height / 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      items.push(
        itemFrom(word, {
          x: width / 2 + dx * c - dy * s,
          y: height / 2 + dx * s + dy * c,
          rotate: 0,
        }),
      );
      continue;
    }

    if (motion === "wave") {
      const waveAmp = (direction === "vertical" ? width : height) * 0.04 * amp;
      const phase = time * Math.PI * 2;
      items.push(
        itemFrom(word, {
          x:
            word.x +
            (direction === "vertical"
              ? Math.sin((word.y / height) * Math.PI * 2 + phase) * waveAmp
              : 0),
          y:
            word.y +
            (direction === "vertical"
              ? 0
              : Math.sin((word.x / width) * Math.PI * 2 + phase) * waveAmp),
        }),
      );
      continue;
    }

    if (motion === "float") {
      const bob = (8 + word.size * 0.12) * amp;
      items.push(
        itemFrom(word, {
          y: word.y + Math.sin(time * Math.PI * 2 + word.phase * Math.PI * 2) * bob,
        }),
      );
      continue;
    }

    if (motion === "pulse") {
      const scale = 1 + 0.055 * amp * Math.sin(time * Math.PI * 2);
      items.push(
        itemFrom(word, {
          x: width / 2 + (word.x - width / 2) * scale,
          y: height / 2 + (word.y - height / 2) * scale,
          size: word.size * scale,
        }),
      );
      continue;
    }

    if (motion === "sweep") {
      const vertical = direction === "up" || direction === "down";
      const sign = signFor(direction);
      const pos = vertical ? word.y / height : word.x / width;
      const head = fract(sign * time);
      const delta = Math.abs(pos - head);
      const distance = Math.min(delta, 1 - delta);
      const band = 0.16 + 0.08 * amp;
      const lit = Math.max(0, 1 - distance / band);
      items.push(itemFrom(word, { opacity: 0.18 + 0.82 * lit }));
      continue;
    }

    if (motion === "burst") {
      const k = ((1 - Math.cos(time * Math.PI * 2)) / 2) * amp;
      const vx = (word.x - width / 2) / (width * 0.5);
      const vy = (word.y - height / 2) / (height * 0.5);
      items.push(
        itemFrom(word, {
          x: word.x + vx * k * width * 0.16,
          y: word.y + vy * k * height * 0.16,
          opacity: 1 - Math.min(0.4, k * 0.28),
        }),
      );
      continue;
    }

    const phase = direction === "reverse" ? word.phase - time : word.phase + time;
    const bump = 0.5 + 0.5 * Math.cos(fract(phase) * Math.PI * 2);
    items.push(
      itemFrom(word, {
        opacity: 0.16 + 0.84 * bump,
        size: word.size * (0.94 + 0.1 * bump),
      }),
    );
  }
  return items;
}

export function visibleItems(words, t, params) {
  const pad = 160;
  return frameItems(words, t, params).filter(
    (item) =>
      item.x > -pad &&
      item.y > -pad &&
      item.x < params.width + pad &&
      item.y < params.height + pad,
  );
}

function svgNum(value) {
  return (Math.round(value * 100) / 100).toString();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgText(word, x, y) {
  const rotate = word.rotate ? (word.rotate * 180) / Math.PI : 0;
  return `<g transform="translate(${svgNum(x)} ${svgNum(y)}) rotate(${svgNum(rotate)})">
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" fill="${word.color}" font-size="${svgNum(word.size)}" font-weight="600">${escapeXml(word.text)}</text>
      </g>`;
}

function linearSvg(words, params, dur) {
  const { width, height, direction, motion } = params;
  const vertical = direction === "up" || direction === "down";
  const span = vertical ? height : width;
  const sign = signFor(direction);
  return words.map((word) => {
    const loops = motion === "pass" ? word.loops : 1;
    const travel = sign * span * loops;
    const copies = [];
    for (let i = -1; i <= loops + 1; i += 1) {
      const offset = -sign * span * i;
      copies.push(svgText(
        word,
        vertical ? word.x : word.x + offset,
        vertical ? word.y + offset : word.y,
      ));
    }
    const dx = vertical ? 0 : travel;
    const dy = vertical ? travel : 0;
    return `<g>
      <animateTransform attributeName="transform" type="translate" values="0 0; ${svgNum(dx)} ${svgNum(dy)}" keyTimes="0;1" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>
      ${copies.join("\n      ")}
    </g>`;
  }).join("\n  ");
}

function sampledSvg(words, params, dur) {
  const steps = 33;
  const tracks = new Map();
  for (let step = 0; step < steps; step += 1) {
    const t = step / (steps - 1);
    for (const item of frameItems(words, t, params)) {
      const key = String(item.id);
      if (!tracks.has(key)) {
        tracks.set(key, { ...item, xs: [], ys: [], sizes: [], opacities: [] });
      }
      const track = tracks.get(key);
      track.xs.push(item.x);
      track.ys.push(item.y);
      track.sizes.push(item.size);
      track.opacities.push(item.opacity);
    }
  }
  const keyTimes = Array.from({ length: steps }, (_, index) =>
    (index / (steps - 1)).toFixed(4),
  ).join(";");
  const varying = (values) => values.some((value) => Math.abs(value - values[0]) > 0.05);
  const anim = (name, values) =>
    varying(values)
      ? `<animate attributeName="${name}" values="${values.map(svgNum).join(";")}" keyTimes="${keyTimes}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>`
      : "";
  const texts = [];
  for (const track of tracks.values()) {
    if (track.xs.length !== steps) continue;
    const rotate = track.rotate ? (track.rotate * 180) / Math.PI : 0;
    const moves = varying(track.xs) || varying(track.ys);
    const points = track.xs
      .map((x, index) => `${svgNum(x)} ${svgNum(track.ys[index])}`)
      .join(";");
    const shift = moves
      ? `<animateTransform attributeName="transform" type="translate" values="${points}" keyTimes="${keyTimes}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>`
      : "";
    const origin = moves ? "" : ` transform="translate(${svgNum(track.xs[0])} ${svgNum(track.ys[0])})"`;
    texts.push(`<g${origin}>
      ${shift}
      <g transform="rotate(${svgNum(rotate)})">
        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" fill="${track.color}" font-size="${svgNum(track.sizes[0])}" font-weight="600">${escapeXml(track.text)}${anim("opacity", track.opacities)}${anim("font-size", track.sizes)}</text>
      </g>
    </g>`);
  }
  return texts.join("\n  ");
}

export function buildSvg(words, params) {
  const { width, height, background, duration, motion } = params;
  const dur = `${duration}s`;
  const body = motion === "scroll" || motion === "pass"
    ? linearSvg(words, params, dur)
    : sampledSvg(words, params, dur);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif">
  <rect width="100%" height="100%" fill="${background}"/>
  ${body}
</svg>
`;
}
