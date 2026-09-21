function standardize(value, mean, stdDev) {
  return (value - mean) / stdDev;
}

function parseRequiredNumber(id) {
  const raw = document.getElementById(id).value;
  if (raw === "" || raw === null) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const FIELD_IDS = [
  "horyuRate",
  "houjuRate",
  "furoRate",
  "riichiRate",
  "damaRate",
  "averageScore",
  "avgHoryuTurn",
  "avgHoujuScore",
  "ryukyokuRate",
  "riichiTurn",
  "riichiFirstRate",
  "riichiChaseRate",
];

const INTENSITY = {
  extreme: { en: "Extreme", jp: "超重度" },
  heavy: { en: "Heavy", jp: "重度" },
  moderate: { en: "Moderate", jp: "中度" },
  mild: { en: "Mild", jp: "軽度" },
  balanced: { en: "Balanced", jp: "中庸" },
};

const TYPES = {
  lateCounter: {
    en: "Late Counter",
    jp: "後手反撃型",
    description:
      "A counter style with higher riichi and chasing-riichi rates. Dama wins are less common; you tend to build a solid hand and push back.",
  },
  closedValue: {
    en: "Closed Value",
    jp: "門前打点型",
    description:
      "Strong closed-hand focus with bigger single wins. Win turns tend to be later, with more value-oriented hands.",
  },
  ironWall: {
    en: "Iron Wall",
    jp: "鉄壁地蔵型",
    description:
      "A closed defensive style that folds early and does not force tenpai. Higher dama rate and valued for a low deal-in rate.",
  },
  leadAndFold: {
    en: "Lead and Fold",
    jp: "先手躱手型",
    description:
      "High first-riichi rate: when someone else takes the lead, you often decline to contest. You advance while managing risk.",
  },
  openSpeed: {
    en: "Open Speed",
    jp: "副露速度型",
    description:
      "Higher call rate and a speed-oriented game. You tend to progress with wide acceptance while keeping attack and defense in balance.",
  },
  allInFighter: {
    en: "All-In Fighter",
    jp: "全局参加型",
    description:
      "The greediest scoring style—sticky and eager to win or stay tenpai. Deal-in rate is also higher; you often join the fight.",
  },
};

// --- amae-koromo import ----------------------------------------------------

const AMAE_API = "https://5-data.amae-koromo.com/api/v2/pl4";
const AMAE_EPOCH_MS = 1262304000000; // 2010-01-01 — same window community tools use

// API returns Simplified Chinese keys; keep JP aliases as fallbacks.
const AMAE_FIELD_MAP = [
  { id: "horyuRate", keys: ["和牌率", "和了率"], asPercent: true },
  { id: "houjuRate", keys: ["放铳率", "放銃率"], asPercent: true },
  { id: "furoRate", keys: ["副露率"], asPercent: true },
  { id: "riichiRate", keys: ["立直率"], asPercent: true },
  { id: "damaRate", keys: ["默听率", "黙聴率", "ダマ率"], asPercent: true },
  { id: "averageScore", keys: ["平均打点"], asPercent: false, integers: true },
  { id: "avgHoryuTurn", keys: ["和了巡数"], asPercent: false },
  { id: "avgHoujuScore", keys: ["平均铳点", "平均放銃"], asPercent: false, integers: true },
  { id: "ryukyokuRate", keys: ["流听率", "流局聴牌率", "流局時聴牌率"], asPercent: true },
  { id: "riichiTurn", keys: ["立直巡目"], asPercent: false },
  { id: "riichiFirstRate", keys: ["先制率"], asPercent: true },
  { id: "riichiChaseRate", keys: ["追立率", "追っかけ率"], asPercent: true },
];

function setImportStatus(message, kind) {
  const el = document.getElementById("importStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("is-error", "is-ok");
  if (kind === "error") el.classList.add("is-error");
  if (kind === "ok") el.classList.add("is-ok");
}

function clearImportMatches() {
  const list = document.getElementById("importMatches");
  if (!list) return;
  list.innerHTML = "";
  list.hidden = true;
}

const AMAE_MODE_LABELS = {
  8: "Gold South",
  9: "Gold East",
  11: "Jade East",
  12: "Jade South",
  15: "Throne East",
  16: "Throne South",
};

function parseImportQuery(raw) {
  const text = String(raw || "").trim();
  const fromUrl = text.match(/\/player\/(\d+)(?:\/([\d.]+))?/i);
  if (fromUrl) {
    return { accountId: fromUrl[1], urlMode: fromUrl[2] || null };
  }
  if (/^\d{5,}$/.test(text)) {
    return { accountId: text, urlMode: null };
  }
  return { accountId: null, urlMode: null };
}

function describeMode(mode) {
  return String(mode)
    .split(".")
    .map((id) => AMAE_MODE_LABELS[id] || `mode ${id}`)
    .join(" + ");
}

function roundStat(value, { asPercent, integers }) {
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (asPercent) n *= 100;
  if (integers) return Math.round(n);
  return Math.round(n * 1000) / 1000;
}

function pickStat(stats, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(stats, key) && stats[key] != null) {
      return stats[key];
    }
  }
  return null;
}

function fillFormFromExtendedStats(stats) {
  const missing = [];
  for (const field of AMAE_FIELD_MAP) {
    const raw = pickStat(stats, field.keys);
    const value = roundStat(raw, field);
    const input = document.getElementById(field.id);
    if (value === null || !input) {
      missing.push(field.id);
      continue;
    }
    input.value = String(value);
  }
  return missing;
}

function amaeRequestUrls(path) {
  const url = `${AMAE_API}${path}`;
  return [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    // GitHub Pages cannot call amae-koromo directly; this reader still allows CORS.
    `https://r.jina.ai/${url}`,
  ];
}

function parseAmaeBody(text) {
  const trimmed = String(text || "").trim();
  const marker = "Markdown Content:";
  const idx = trimmed.indexOf(marker);
  const payload = (idx >= 0 ? trimmed.slice(idx + marker.length) : trimmed).trim();
  try {
    return JSON.parse(payload);
  } catch {
    const startObj = payload.indexOf("{");
    const startArr = payload.indexOf("[");
    const start = [startObj, startArr].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (start == null) {
      throw new Error("Unexpected MajSoul Stats response.");
    }
    return JSON.parse(payload.slice(start));
  }
}

async function fetchWithTimeout(url, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readAmaeResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = parseAmaeBody(text);
  } catch {
    data = null;
  }

  const notFound =
    res.status === 404 ||
    /returned error 404/i.test(text) ||
    (data && data.error === "id_not_found");
  if (notFound) {
    const err = new Error("No recorded data for this player/room filter.");
    err.code = 404;
    throw err;
  }
  if (res.status === 429 || /returned error 429/i.test(text)) {
    const err = new Error("MajSoul Stats rate-limited the request. Wait a moment and try again.");
    err.code = 429;
    throw err;
  }
  if (data == null) {
    if (!res.ok) {
      throw new Error(`MajSoul Stats request failed (${res.status}).`);
    }
    throw new Error("Unexpected MajSoul Stats response.");
  }
  if (!res.ok && res.status !== 200) {
    throw new Error(`MajSoul Stats request failed (${res.status}).`);
  }
  return data;
}

async function amaeFetch(path) {
  const urls = amaeRequestUrls(path);
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      return await readAmaeResponse(res);
    } catch (err) {
      lastError = err;
      if (err && (err.code === 404 || err.code === 429)) {
        throw err;
      }
    }
  }
  if (lastError && (lastError.name === "TypeError" || lastError.name === "AbortError")) {
    throw new Error(
      "Could not reach MajSoul Stats from this site. Try again, or fill the fields manually."
    );
  }
  throw lastError || new Error("Could not load MajSoul Stats.");
}

async function searchAmaePlayers(query) {
  const encoded = encodeURIComponent(query.trim());
  const data = await amaeFetch(`/search_player/${encoded}?limit=20&tag=all`);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected search response from MajSoul Stats.");
  }
  return data;
}

function amaeStatsPath(kind, accountId, mode) {
  const end = Date.now();
  return `/${kind}/${accountId}/${AMAE_EPOCH_MS}/${end}?mode=${encodeURIComponent(mode)}`;
}

async function fetchExtendedStats(accountId, mode) {
  return amaeFetch(amaeStatsPath("player_extended_stats", accountId, mode));
}

async function fetchPlayerOverview(accountId, mode) {
  return amaeFetch(amaeStatsPath("player_stats", accountId, mode));
}

function levelLabel(level) {
  if (!level || level.id == null) return "unknown rank";
  return `level ${level.id}`;
}

function renderImportMatches(players) {
  const list = document.getElementById("importMatches");
  list.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML =
      `<strong>${escapeHtml(player.nickname || "(no name)")}</strong>` +
      `<span class="match-meta">ID ${escapeHtml(String(player.id))} · ${escapeHtml(levelLabel(player.level))}</span>`;
    btn.addEventListener("click", () => {
      importPlayerById(player.id, player.nickname);
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
  list.hidden = players.length === 0;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function importPlayerById(accountId, nickname, modeOverride) {
  const mode = modeOverride || document.getElementById("importMode").value;
  const searchBtn = document.getElementById("importSearchBtn");
  clearImportMatches();
  searchBtn.disabled = true;
  setImportStatus(
    `Loading stats for ${nickname || "player"} (${accountId})…`,
    null
  );
  try {
    const [stats, overview] = await Promise.all([
      fetchExtendedStats(accountId, mode),
      fetchPlayerOverview(accountId, mode).catch(() => null),
    ]);
    const missing = fillFormFromExtendedStats(stats);
    const displayName = nickname || overview?.nickname || accountId;
    const matches = overview?.count;
    const hands = stats.count;
    const room = describeMode(mode);
    let games;
    if (matches != null) {
      games = `${matches} matches`;
      if (hands != null && hands !== matches) {
        games += ` / ${hands} hands`;
      }
    } else if (hands != null) {
      games = `${hands} hands`;
    } else {
      games = "unknown match count";
    }
    games += ` (${room})`;
    if (missing.length) {
      setImportStatus(
        `Imported ${displayName} (${games}), but missing: ${missing.join(", ")}.`,
        "error"
      );
      return;
    }
    setImportStatus(
      `Imported ${displayName} — ${games}. Click Analyze when ready.`,
      "ok"
    );
  } catch (err) {
    setImportStatus(err.message || String(err), "error");
  } finally {
    searchBtn.disabled = false;
  }
}

async function runImportSearch() {
  const queryEl = document.getElementById("importQuery");
  const searchBtn = document.getElementById("importSearchBtn");
  const query = queryEl.value.trim();
  clearImportMatches();
  if (!query) {
    setImportStatus("Enter a player name, account ID, or MajSoul Stats URL.", "error");
    return;
  }

  searchBtn.disabled = true;
  setImportStatus("Searching MajSoul Stats…", null);
  try {
    const parsed = parseImportQuery(query);
    if (parsed.accountId) {
      await importPlayerById(parsed.accountId, null, parsed.urlMode);
      return;
    }
    const matches = await searchAmaePlayers(query);
    if (!matches.length) {
      setImportStatus(
        "No players found. Try the exact nickname, or an account ID from amae-koromo.",
        "error"
      );
      return;
    }
    if (matches.length === 1) {
      await importPlayerById(matches[0].id, matches[0].nickname);
      return;
    }
    setImportStatus(`Found ${matches.length} players — pick one:`, null);
    renderImportMatches(matches);
  } catch (err) {
    setImportStatus(err.message || String(err), "error");
  } finally {
    searchBtn.disabled = false;
  }
}

function initImportUi() {
  const searchBtn = document.getElementById("importSearchBtn");
  const queryEl = document.getElementById("importQuery");
  if (!searchBtn || !queryEl) return;
  searchBtn.addEventListener("click", runImportSearch);
  queryEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runImportSearch();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initImportUi);
} else {
  initImportUi();
}

function analyze() {
  const resultEl = document.getElementById("result");

  const values = {};
  for (const id of FIELD_IDS) {
    const n = parseRequiredNumber(id);
    if (n === null) {
      resultEl.textContent =
        "Please fill in all 12 stats with numbers before analyzing.";
      return;
    }
    values[id] = n;
  }

  // Standardization (identical means/stddevs to the original tool)
  const horyuRate = standardize(values.horyuRate / 100, 0.229400816, 0.01018886);
  const houjuRate = standardize(values.houjuRate / 100, 0.11106952, 0.009595166);
  const furoRate = standardize(values.furoRate / 100, 0.331713127, 0.037372193);
  const riichiRate = standardize(values.riichiRate / 100, 0.182824374, 0.018407074);
  const damaRate = standardize(values.damaRate / 100, 0.128029668, 0.029703506);
  const averageScore = standardize(values.averageScore, 6454.787778, 235.6563516);
  const avgHoryuTurn = standardize(values.avgHoryuTurn, 12.12006667, 0.11553016);
  const avgHoujuScore = standardize(values.avgHoujuScore, 5387.771667, 141.1658779);
  const ryukyokuRate = standardize(values.ryukyokuRate / 100, 0.421591309, 0.04623791);
  const riichiTurn = standardize(values.riichiTurn, 9.298394589, 0.193397116);
  const riichiFirstRate = standardize(values.riichiFirstRate / 100, 0.828159779, 0.021060104);
  const riichiChaseRate = standardize(values.riichiChaseRate / 100, 0.171840221, 0.021060104);

  // PCA projection (identical weights to the original tool)
  const X =
    horyuRate * -1.166081274 +
    houjuRate * -0.202381694 +
    furoRate * -1.258740534 +
    riichiRate * -0.013917045 +
    damaRate * 0.708071254 +
    averageScore * 1.249496931 +
    avgHoryuTurn * 0.73499073 +
    avgHoujuScore * -0.231466343 +
    ryukyokuRate * -0.585817047 +
    riichiTurn * 0.831715773 +
    riichiFirstRate * -0.612817769 +
    riichiChaseRate * 0.546947012;

  const Y =
    horyuRate * 0.22551386 +
    houjuRate * 0.889258806 +
    furoRate * -0.453560713 +
    riichiRate * 0.451204072 +
    damaRate * -1.48123253 +
    averageScore * -0.194681556 +
    avgHoryuTurn * 0.531014201 +
    avgHoujuScore * 0.202878547 +
    ryukyokuRate * 0.81983416 +
    riichiTurn * 0.644693651 +
    riichiFirstRate * -2.393675857 +
    riichiChaseRate * 0.75875334;

  const S = Math.sqrt(X * X + Y * Y);
  const A = Y / X;

  let intensity;
  if (S > 12.71) intensity = INTENSITY.extreme;
  else if (S > 8.89) intensity = INTENSITY.heavy;
  else if (S > 3.2) intensity = INTENSITY.moderate;
  else if (S > 1.47) intensity = INTENSITY.mild;
  else intensity = INTENSITY.balanced;

  let type;
  if (A > 1) {
    type = X > 0 ? TYPES.lateCounter : TYPES.leadAndFold;
  } else if (A > -0.35) {
    type = X > 0 ? TYPES.closedValue : TYPES.openSpeed;
  } else {
    type = X > 0 ? TYPES.ironWall : TYPES.allInFighter;
  }

  const intensityLabel = `${intensity.en} (${intensity.jp})`;
  const typeLabel = `${type.en} (${type.jp})`;
  const article = intensity.en === "Extreme" ? "an" : "a";

  resultEl.innerHTML =
    `X: ${X.toFixed(2)}, Y: ${Y.toFixed(2)}<br>` +
    `You are ${article} ${intensityLabel} ${typeLabel} type.<br>` +
    `<span class="result-desc">${type.description}</span>`;

  plotResult(X, Y);
}

function drawPlotLabel(ctx, text, px, py, { dx = 4, dy = -2, align = "left", font, color, maxW, maxH }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  let tx = px + dx;
  let ty = py + dy;
  const metrics = ctx.measureText(text);
  const w = metrics.width;
  const pad = 4;

  if (align === "left") {
    tx = Math.min(tx, maxW - w - pad);
    tx = Math.max(tx, pad);
  } else if (align === "right") {
    tx = Math.max(tx, w + pad);
    tx = Math.min(tx, maxW - pad);
  } else {
    tx = Math.min(Math.max(tx, w / 2 + pad), maxW - w / 2 - pad);
  }
  ty = Math.min(Math.max(ty, 12), maxH - 12);

  ctx.fillText(text, tx, ty);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function plotResult(X, Y) {
  const canvas = document.getElementById("plotCanvas");
  const ctx = canvas.getContext("2d");
  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const scale = 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();

  ctx.font = "10px Arial";
  ctx.fillStyle = "black";
  for (let i = -25; i <= 25; i += 5) {
    if (i !== 0) {
      ctx.fillText(String(i), originX + i * scale - 5, originY + 15);
      ctx.beginPath();
      ctx.moveTo(originX + i * scale, originY - 5);
      ctx.lineTo(originX + i * scale, originY + 5);
      ctx.stroke();

      ctx.fillText(String(i), originX + 5, originY - i * scale + 3);
      ctx.beginPath();
      ctx.moveTo(originX - 5, originY - i * scale);
      ctx.lineTo(originX + 5, originY - i * scale);
      ctx.stroke();
    }
  }

  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "green";

  ctx.beginPath();
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, originY - 0.35 * originX);
  ctx.lineTo(canvas.width, originY + 0.35 * originX);
  ctx.stroke();

  ctx.setLineDash([]);

  // Stat markers first — labels nudge toward the origin so they clear corner type titles
  bluedataPoints.forEach((point) => {
    const px = originX + point.x * scale;
    const py = originY - point.y * scale;
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    drawPlotLabel(ctx, point.label, px, py, {
      dx: point.dx,
      dy: point.dy,
      align: point.align,
      font: "normal 9px Arial",
      color: "blue",
      maxW: canvas.width,
      maxH: canvas.height,
    });
  });

  // Type names in clear corner / edge pockets (fixed canvas positions)
  ctx.fillStyle = "black";
  ctx.font = "bold 13px Arial";
  ctx.textBaseline = "middle";
  typeLabelSlots.forEach((slot) => {
    ctx.textAlign = slot.align;
    ctx.fillText(slot.label, slot.x * canvas.width, slot.y * canvas.height);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Player result last so it stays on top
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(originX + X * scale, originY - Y * scale, 8, 0, Math.PI * 2);
  ctx.fill();
}

// Labels face toward origin so English text doesn't stack on the rim
const bluedataPoints = [
  { label: "Win rate", x: -20.0, y: 3.9, dx: 6, dy: 0, align: "left" },
  { label: "Deal-in rate", x: -4.6, y: 20.0, dx: -12, dy: 16, align: "right" },
  { label: "Call rate", x: -20.0, y: -7.2, dx: 6, dy: 0, align: "left" },
  { label: "Riichi rate", x: -0.6, y: 20.0, dx: 14, dy: 30, align: "left" },
  { label: "Dama rate", x: 9.6, y: -20.0, dx: 8, dy: -14, align: "left" },
  { label: "Avg win score", x: 20.0, y: -3.1, dx: -6, dy: -10, align: "right" },
  { label: "Win turns", x: 20.0, y: 14.4, dx: -8, dy: 18, align: "right" },
  { label: "Deal-in pts", x: -20.0, y: 17.5, dx: 6, dy: 6, align: "left" },
  { label: "Draw tenpai", x: -14.3, y: 20.0, dx: 0, dy: -14, align: "center" },
  { label: "Riichi turn", x: 20.0, y: 15.5, dx: -8, dy: -6, align: "right" },
  { label: "First riichi", x: -5.1, y: -20.0, dx: -8, dy: -14, align: "right" },
  { label: "Chasing riichi", x: 14.4, y: 20.0, dx: 0, dy: -14, align: "center" },
];

// Fraction of canvas size — keeps English type names out of the blue label ring
const typeLabelSlots = [
  { label: "All-In Fighter", x: 0.18, y: 0.055, align: "center" },
  { label: "Late Counter", x: 0.82, y: 0.055, align: "center" },
  { label: "Lead and Fold", x: 0.18, y: 0.945, align: "center" },
  { label: "Iron Wall", x: 0.82, y: 0.945, align: "center" },
  { label: "Open Speed", x: 0.08, y: 0.58, align: "left" },
  { label: "Closed Value", x: 0.92, y: 0.42, align: "right" },
];
