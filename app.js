const INITIAL_BOYS = ["顾星辰", "江叙白", "秋亦帆", "林泽宇"];
const INITIAL_GIRLS = ["苏晚晴", "夏知柚", "许星眠", "温以宁"];
const STORAGE_KEY = "dm-favorite-quote-sheet-v2";

const state = {
  boys: [...INITIAL_BOYS],
  girls: [...INITIAL_GIRLS],
  answers: {}
};

const tables = document.querySelector("#tables");
const toast = document.querySelector("#toast");
let toastTimer;

function keyFor(name) {
  return name;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  })[char]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1900);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // 存储不可用时不影响填写与导出。
  }
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    if (Array.isArray(saved.boys) && saved.boys.length === 4) state.boys = saved.boys;
    if (Array.isArray(saved.girls) && saved.girls.length === 4) state.girls = saved.girls;
    if (saved.answers && typeof saved.answers === "object") state.answers = saved.answers;
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function tableMarkup(label, people) {
  const body = people.map((name) => {
    const key = keyFor(name);
    const value = state.answers[key] || "";
    return `<tr>
      <th scope="row">${escapeHtml(name)}</th>
      <td><textarea class="answer-cell" maxlength="80" rows="2" data-key="${escapeHtml(key)}" aria-label="${escapeHtml(name)}最喜欢的一句话" placeholder="在这里填写喜欢的一句话">${escapeHtml(value)}</textarea></td>
    </tr>`;
  }).join("");

  return `
    <article class="answer-card">
      <h2 class="card-heading">${label}</h2>
      <table class="answer-table">
        <thead><tr><th scope="col">名字</th><th scope="col">最喜欢的一句话</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </article>`;
}

function renderTables() {
  tables.innerHTML =
    tableMarkup("男生角色", state.boys) +
    tableMarkup("女生角色", state.girls);

  tables.querySelectorAll(".answer-cell").forEach((input) => {
    input.addEventListener("input", (event) => {
      state.answers[event.currentTarget.dataset.key] = event.currentTarget.value;
      saveState();
    });
  });
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function shuffleNames() {
  state.boys = shuffled(state.boys);
  state.girls = shuffled(state.girls);
  renderTables();
  saveState();
  showToast("名字顺序已打乱");
}

function clearAll() {
  const hasContent = Object.values(state.answers).some((value) => value.trim());
  if (hasContent && !window.confirm("确定清空全部填写内容吗？")) return;
  state.answers = {};
  renderTables();
  saveState();
  showToast("内容已清空");
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function fitText(ctx, text, maxWidth, preferredSize, minimumSize = 20) {
  let size = preferredSize;
  while (size > minimumSize) {
    ctx.font = `400 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function wrapCellText(ctx, value, width, maxLines = 2) {
  const text = String(value || "").trim();
  if (!text) return [];
  const lines = [];
  let line = "";
  for (const char of [...text]) {
    const test = line + char;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  const consumed = lines.join("").length + line.length;
  if (consumed < text.length) line = `${line.slice(0, -1)}…`;
  lines.push(line);
  return lines.slice(0, maxLines);
}

function drawCenteredText(ctx, text, x, y, width, height, options = {}) {
  const {
    size = 27,
    color = "#765e63",
    family = '"Microsoft YaHei", "PingFang SC", sans-serif',
    maxLines = 1
  } = options;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const actualSize = fitText(ctx, text, width - 18, size, 18);
  ctx.font = `400 ${actualSize}px ${family}`;
  const lines = maxLines > 1 ? wrapCellText(ctx, text, width - 16, maxLines) : [text];
  const lineHeight = actualSize * 1.18;
  const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x + width / 2, firstY + index * lineHeight));
  ctx.restore();
}

function drawRule(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawTable(ctx, config) {
  const { x, y, width, label, rows, hideNames } = config;
  const headingHeight = 72;
  const headerHeight = 70;
  const rowHeight = 92;
  const height = headingHeight + headerHeight + rowHeight * rows.length;
  const firstWidth = 250;
  const answerWidth = width - firstWidth;

  ctx.save();
  ctx.shadowColor = "rgba(103, 72, 78, .12)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundedRect(ctx, x, y, width, height, 34);
  ctx.fillStyle = "rgba(255, 252, 251, .88)";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(185, 139, 147, .30)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  roundedRect(ctx, x, y, width, height, 34);
  ctx.clip();
  ctx.fillStyle = "rgba(246, 232, 232, .58)";
  ctx.fillRect(x, y + headingHeight, width, headerHeight);
  ctx.strokeStyle = "rgba(181, 134, 142, .32)";
  ctx.lineWidth = 2;
  drawRule(ctx, x, y + headingHeight, x + width, y + headingHeight);
  drawRule(ctx, x, y + headingHeight + headerHeight, x + width, y + headingHeight + headerHeight);

  for (let row = 1; row < rows.length; row += 1) {
    const rowY = y + headingHeight + headerHeight + rowHeight * row;
    drawRule(ctx, x, rowY, x + width, rowY);
  }
  drawRule(ctx, x + firstWidth, y + headingHeight, x + firstWidth, y + height);
  ctx.restore();

  ctx.fillStyle = "#e5b8c0";
  roundedRect(ctx, x + 28, y + 22, 8, 28, 5);
  ctx.fill();
  ctx.font = '400 34px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillStyle = "#806269";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 51, y + headingHeight / 2 + 1);

  if (!hideNames) {
    drawCenteredText(ctx, "名字", x, y + headingHeight, firstWidth, headerHeight, { size: 27, color: "#92777c" });
    rows.forEach((name, row) => {
      drawCenteredText(ctx, name, x, y + headingHeight + headerHeight + rowHeight * row, firstWidth, rowHeight, { size: 27 });
    });
  }
  drawCenteredText(ctx, "最喜欢的一句话", x + firstWidth, y + headingHeight, answerWidth, headerHeight, { size: 28, color: "#92777c" });

  rows.forEach((rowName, row) => {
    const value = state.answers[keyFor(rowName)] || "";
    drawCenteredText(
      ctx,
      value,
      x + firstWidth,
      y + headingHeight + headerHeight + rowHeight * row,
      answerWidth,
      rowHeight,
      { size: 29, color: "#6f585d", maxLines: 2 }
    );
  });
  ctx.restore();
}

async function exportImage(hideNames = false) {
  const activeButton = hideNames
    ? document.querySelector("#exportHiddenBtn")
    : document.querySelector("#exportBtn");
  const originalText = activeButton.textContent;
  activeButton.disabled = true;
  activeButton.textContent = "正在生成…";

  try {
    if (document.fonts) await document.fonts.ready;
    const [background, logo] = await Promise.all([
      loadImage("background.png"),
      loadImage("logo.png")
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 252, 251, .04)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const logoWidth = 505;
    const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, 42, 32, logoWidth, logoHeight);

    ctx.strokeStyle = "rgba(168, 113, 123, .48)";
    ctx.lineWidth = 2;
    drawRule(ctx, 115, 421, 275, 421);
    drawRule(ctx, 805, 421, 965, 421);
    ctx.fillStyle = "rgba(168, 113, 123, .64)";
    ctx.beginPath();
    ctx.arc(295, 421, 5, 0, Math.PI * 2);
    ctx.arc(785, 421, 5, 0, Math.PI * 2);
    ctx.fill();

    drawCenteredText(ctx, "最喜欢的一句话", 300, 345, 480, 150, {
      size: 64,
      color: "#846369",
      family: '"梦时手写", "Kaiti SC", STKaiti, KaiTi, cursive',
      maxLines: 2
    });

    drawTable(ctx, {
      x: 44, y: 500, width: 992,
      label: "男生角色",
      rows: state.boys,
      hideNames
    });
    drawTable(ctx, {
      x: 44, y: 1060, width: 992,
      label: "女生角色",
      rows: state.girls,
      hideNames
    });

    ctx.strokeStyle = "rgba(163, 116, 124, .35)";
    ctx.lineWidth = 2;
    drawRule(ctx, 170, 1700, 408, 1700);
    drawRule(ctx, 672, 1700, 910, 1700);
    drawCenteredText(ctx, "记录每一句喜欢", 408, 1671, 264, 58, {
      size: 25,
      color: "rgba(126, 89, 96, .72)"
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("图片生成失败");
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = hideNames ? "心动答案表_隐藏名字.png" : "心动答案表_完整.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(hideNames ? "匿名图片已导出" : "完整图片已导出");
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重试");
  } finally {
    activeButton.disabled = false;
    activeButton.textContent = originalText;
  }
}

function init() {
  restoreState();
  renderTables();

  document.querySelector("#shuffleBtn").addEventListener("click", shuffleNames);
  document.querySelector("#clearBtn").addEventListener("click", clearAll);
  document.querySelector("#exportBtn").addEventListener("click", () => exportImage(false));
  document.querySelector("#exportHiddenBtn").addEventListener("click", () => exportImage(true));
}

init();
