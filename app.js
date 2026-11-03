import { GIFEncoder, applyPalette, quantize } from "./vendor/gifenc.esm.js";
import {
  FONT,
  MAX_WORDS,
  MOTIONS,
  PALETTES,
  SHAPES,
  buildSvg,
  frameItems,
  layoutWords,
  motionById,
  parseWords,
  visibleItems,
} from "./engine.js";

const SAMPLE = `创新 10
设计 8
动画 8
词云 7
演示 6
滚动 6
节奏 5
重点 5
结构 4
色彩 4
留白 3
清晰 3`;

const SIZES = [
  [960, 540, "960×540 放映优先"],
  [1280, 720, "1280×720 标准"],
  [800, 800, "800×800 方形"],
  [1920, 1080, "1920×1080 大文件"],
];

const state = {
  source: SAMPLE,
  motion: "scroll",
  direction: "up",
  duration: 6,
  amplitude: 1,
  shape: "cloud",
  paletteId: "ink",
  background: "#f3f5f7",
  backgroundTouched: false,
  minSize: 22,
  maxSize: 68,
  gap: 8,
  mixedAngle: false,
  sizeIndex: 1,
  fps: 10,
  maxColors: 128,
  seed: 1,
  playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  words: [],
  placed: 0,
  exporting: false,
};

const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
const els = {
  source: document.querySelector("#words"),
  motion: document.querySelector("#motion"),
  direction: document.querySelector("#direction"),
  hint: document.querySelector("#motion-hint"),
  duration: document.querySelector("#duration"),
  durationOut: document.querySelector("#duration-out"),
  amplitude: document.querySelector("#amplitude"),
  amplitudeOut: document.querySelector("#amplitude-out"),
  shape: document.querySelector("#shape"),
  palette: document.querySelector("#palette"),
  background: document.querySelector("#background"),
  minSize: document.querySelector("#min-size"),
  maxSize: document.querySelector("#max-size"),
  gap: document.querySelector("#gap"),
  gapOut: document.querySelector("#gap-out"),
  minOut: document.querySelector("#min-out"),
  maxOut: document.querySelector("#max-out"),
  mixed: document.querySelector("#mixed-angle"),
  size: document.querySelector("#size"),
  fps: document.querySelector("#fps"),
  colors: document.querySelector("#colors"),
  count: document.querySelector("#count"),
  status: document.querySelector("#status"),
  meter: document.querySelector("#meter"),
  meterBar: document.querySelector("#meter-bar"),
  play: document.querySelector("#play"),
  reshuffle: document.querySelector("#reshuffle"),
  gif: document.querySelector("#export-gif"),
  svg: document.querySelector("#export-svg"),
};

let startedAt = performance.now();
let layoutTimer = 0;

function sizeOf() {
  return SIZES[state.sizeIndex];
}

function paletteOf() {
  return PALETTES.find((item) => item.id === state.paletteId) || PALETTES[0];
}

function params() {
  const [width, height] = sizeOf();
  return {
    width,
    height,
    motion: state.motion,
    direction: state.direction,
    amplitude: state.amplitude,
    background: state.background,
    duration: state.duration,
  };
}

function setStatus(text) {
  els.status.textContent = text;
}

function fillSelect(select, pairs, selected) {
  select.replaceChildren();
  for (const [value, label] of pairs) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selected;
    select.append(option);
  }
}

function syncDirection() {
  const motion = motionById(state.motion);
  const pairs = motion.dirs.length ? motion.dirs : [["none", "无方向"]];
  if (!pairs.some(([value]) => value === state.direction)) {
    state.direction = pairs[0][0];
  }
  fillSelect(els.direction, pairs, state.direction);
  els.direction.disabled = motion.dirs.length === 0;
  els.hint.textContent = motion.hint;
}

function measure(text, size) {
  ctx.font = `600 ${size}px ${FONT}`;
  return { width: ctx.measureText(text).width };
}

function relayout() {
  const [width, height] = sizeOf();
  canvas.width = width;
  canvas.height = height;
  const parsed = parseWords(state.source);
  state.words = layoutWords(parsed, {
    width,
    height,
    shape: state.shape,
    gap: state.gap,
    minSize: Math.min(state.minSize, state.maxSize - 4),
    maxSize: Math.max(state.maxSize, state.minSize + 4),
    mixedAngle: state.mixedAngle,
    seed: state.seed,
    palette: paletteOf().colors,
    measure,
  });
  state.placed = state.words.length;
  const used = Math.min(parsed.length, MAX_WORDS);
  const dropped = used - state.placed;
  if (!parsed.length) {
    els.count.textContent = "还没有词语";
  } else {
    const cap = parsed.length > MAX_WORDS ? `，最多使用 ${MAX_WORDS} 个` : "";
    const miss = dropped > 0 ? `，${dropped} 个放不下` : "";
    els.count.textContent = `识别 ${parsed.length} 个词${cap}，放下 ${state.placed} 个${miss}`;
  }
}

function draw(t) {
  const view = params();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = view.background;
  ctx.fillRect(0, 0, view.width, view.height);
  if (!state.words.length) {
    ctx.fillStyle = "#314155";
    ctx.font = `600 28px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("在左侧输入词语", view.width / 2, view.height / 2);
    return;
  }
  const items = visibleItems(state.words, t, view);
  for (const item of items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotate || 0);
    ctx.globalAlpha = item.opacity;
    ctx.fillStyle = item.color;
    ctx.font = `600 ${item.size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function tick(now) {
  if (!state.playing || state.exporting) return;
  const t = ((now - startedAt) / 1000 / state.duration) % 1;
  draw(t);
  requestAnimationFrame(tick);
}

function play(next) {
  state.playing = next;
  els.play.textContent = state.playing ? "暂停预览" : "播放预览";
  if (state.playing) {
    startedAt = performance.now();
    requestAnimationFrame(tick);
  } else {
    draw(0);
  }
}

function scheduleLayout() {
  window.clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(() => {
    relayout();
    if (!state.playing) draw(0);
  }, 60);
}

function readControls() {
  state.source = els.source.value;
  state.motion = els.motion.value;
  state.direction = els.direction.value;
  state.duration = Number(els.duration.value);
  state.amplitude = Number(els.amplitude.value);
  state.shape = els.shape.value;
  state.paletteId = els.palette.value;
  state.minSize = Number(els.minSize.value);
  state.maxSize = Number(els.maxSize.value);
  state.gap = Number(els.gap.value);
  state.mixedAngle = els.mixed.checked;
  state.sizeIndex = Number(els.size.value);
  state.fps = Number(els.fps.value);
  state.maxColors = Number(els.colors.value);
  els.durationOut.textContent = `${state.duration.toFixed(1)} 秒`;
  els.amplitudeOut.textContent = state.amplitude.toFixed(1);
  els.gapOut.textContent = `${state.gap}`;
  els.minOut.textContent = `${state.minSize}`;
  els.maxOut.textContent = `${state.maxSize}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbaView(data) {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) return data;
  return new Uint8Array(data);
}

function channelLuma(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const left = channelLuma(a);
  const right = channelLuma(b);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function warnContrast() {
  const ink = paletteOf().colors[0];
  if (contrastRatio(state.background, ink) >= 3) return;
  setStatus("文字色和背景色太接近，导出后会看不清。换一个配色，或改背景色。");
}

function buildPalette(sample) {
  const reserved = [hexToRgb(state.background), ...paletteOf().colors.map(hexToRgb)];
  let sampled = [];
  try {
    sampled = quantize(sample, Math.max(16, state.maxColors - reserved.length), {
      format: "rgb565",
    });
  } catch {
    sampled = [];
  }
  const palette = [];
  const seen = new Set();
  for (const color of [...reserved, ...sampled]) {
    const key = color.slice(0, 3).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    palette.push([color[0], color[1], color[2]]);
    if (palette.length >= state.maxColors) break;
  }
  return palette.length >= 2 ? palette : [[255, 255, 255], [20, 24, 32]];
}

function download(bytes, filename, type) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setBusy(busy) {
  state.exporting = busy;
  els.gif.disabled = busy;
  els.svg.disabled = busy;
  els.meter.hidden = !busy;
}

async function exportGif() {
  readControls();
  relayout();
  if (!state.words.length) {
    setStatus("先输入词语，再导出。");
    return;
  }
  const wasPlaying = state.playing;
  state.playing = false;
  setBusy(true);
  const view = params();
  const frames = Math.max(2, Math.round(state.duration * state.fps));
  const delayCs = Math.max(10, Math.round(100 / state.fps));
  const delay = delayCs * 10;
  try {
    setStatus("正在准备调色板…");
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    draw(0.35);
    const sample = ctx.getImageData(0, 0, view.width, view.height);
    const palette = buildPalette(rgbaView(sample.data));
    const gif = GIFEncoder({ initialCapacity: view.width * view.height });
    for (let frame = 0; frame < frames; frame += 1) {
      draw(frame / frames);
      const image = ctx.getImageData(0, 0, view.width, view.height);
      const index = applyPalette(rgbaView(image.data), palette, "rgb565");
      gif.writeFrame(index, view.width, view.height, {
        palette: frame === 0 ? palette : null,
        delay,
        repeat: 0,
        dispose: 1,
      });
      if (frame % 2 === 0 || frame === frames - 1) {
        const pct = Math.round(((frame + 1) / frames) * 100);
        els.meterBar.style.width = `${pct}%`;
        setStatus(`正在编码 GIF ${frame + 1}/${frames}`);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    gif.finish();
    const bytes = gif.bytes();
    download(bytes, "云帧.gif", "image/gif");
    const mb = (bytes.byteLength / 1024 / 1024).toFixed(1);
    setStatus(
      `已导出 云帧.gif，${mb} MB，${frames} 帧，每帧 ${delayCs / 100} 秒，无限循环。用「插入 - 图片」放进幻灯片，放映时播放。`,
    );
  } catch (error) {
    setStatus(`导出 GIF 失败：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    setBusy(false);
    play(wasPlaying);
  }
}

function exportSvg() {
  readControls();
  relayout();
  if (!state.words.length) {
    setStatus("先输入词语，再导出。");
    return;
  }
  const svg = buildSvg(state.words, params());
  download(new Blob([svg], { type: "image/svg+xml" }), "云帧.svg", "image/svg+xml");
  setStatus("已导出 云帧.svg。浏览器打开可以播放。放进 WPS 或 PowerPoint 后，动画通常不会动，放映请用 GIF。");
}

function bind() {
  fillSelect(
    els.motion,
    MOTIONS.map((item) => [item.id, item.name]),
    state.motion,
  );
  fillSelect(
    els.shape,
    SHAPES,
    state.shape,
  );
  fillSelect(
    els.palette,
    PALETTES.map((item) => [item.id, item.name]),
    state.paletteId,
  );
  fillSelect(
    els.size,
    SIZES.map((item, index) => [String(index), item[2]]),
    String(state.sizeIndex),
  );
  fillSelect(els.fps, [["5", "5 帧/秒"], ["8", "8 帧/秒"], ["10", "10 帧/秒"]], "10");
  fillSelect(els.colors, [["64", "64 色"], ["128", "128 色"], ["256", "256 色"]], "128");
  els.source.value = state.source;
  els.duration.value = String(state.duration);
  els.amplitude.value = String(state.amplitude);
  els.background.value = state.background;
  els.minSize.value = String(state.minSize);
  els.maxSize.value = String(state.maxSize);
  els.gap.value = String(state.gap);
  syncDirection();
  readControls();

  const onLayout = () => {
    readControls();
    scheduleLayout();
  };
  els.source.addEventListener("input", onLayout);
  els.shape.addEventListener("change", onLayout);
  els.minSize.addEventListener("input", onLayout);
  els.maxSize.addEventListener("input", onLayout);
  els.gap.addEventListener("input", onLayout);
  els.mixed.addEventListener("change", onLayout);
  els.size.addEventListener("change", onLayout);
  els.motion.addEventListener("change", () => {
    readControls();
    syncDirection();
    readControls();
    if (!state.playing) draw(0);
  });
  els.direction.addEventListener("change", () => {
    readControls();
    if (!state.playing) draw(0);
  });
  els.duration.addEventListener("input", () => {
    readControls();
  });
  els.amplitude.addEventListener("input", () => {
    readControls();
    if (!state.playing) draw(0);
  });
  els.palette.addEventListener("change", () => {
    readControls();
    if (!state.backgroundTouched) {
      state.background = paletteOf().bg;
      els.background.value = state.background;
    }
    scheduleLayout();
    warnContrast();
  });
  els.background.addEventListener("input", () => {
    state.backgroundTouched = true;
    state.background = els.background.value;
    warnContrast();
    if (!state.playing) draw(0);
  });
  els.fps.addEventListener("change", readControls);
  els.colors.addEventListener("change", readControls);
  els.play.addEventListener("click", () => play(!state.playing));
  els.reshuffle.addEventListener("click", () => {
    state.seed += 1;
    relayout();
    if (!state.playing) draw(0);
  });
  els.gif.addEventListener("click", () => {
    exportGif();
  });
  els.svg.addEventListener("click", exportSvg);
}

bind();
document.fonts.ready.then(() => {
  relayout();
  play(state.playing);
  if (!state.playing) draw(0);
});

// Keep the import used so a bundler-less browser still links the motion model.
void frameItems;
