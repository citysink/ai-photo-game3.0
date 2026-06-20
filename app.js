const statusPanel = document.querySelector("#statusPanel");
const gamePanel = document.querySelector("#gamePanel");
const todayLabel = document.querySelector("#todayLabel");
const caseIdLabel = document.querySelector("#caseIdLabel");
const questionTitle = document.querySelector("#questionTitle");
const questionDescription = document.querySelector("#questionDescription");
const modeLabel = document.querySelector("#modeLabel");
const modeBadge = document.querySelector("#modeBadge");
const modeStripLabel = document.querySelector("#modeStripLabel");
const selectionRuleLabel = document.querySelector("#selectionRuleLabel");
const ruleList = document.querySelector("#ruleList");
const photoGrid = document.querySelector("#photoGrid");
const heroSelectionText = document.querySelector("#heroSelectionText");
const selectionMeterText = document.querySelector("#selectionMeterText");
const selectionHint = document.querySelector("#selectionHint");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultStamp = document.querySelector("#resultStamp");
const resultSummary = document.querySelector("#resultSummary");
const reportMetrics = document.querySelector("#reportMetrics");
const identityList = document.querySelector("#identityList");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxCaption = document.querySelector("#lightboxCaption");
const lightboxClose = document.querySelector("#lightboxClose");

const QUESTION_MODES = {
  single: {
    label: "单选模式",
    shortLabel: "SINGLE",
    badge: "Single",
    rule: "SELECT 1",
    intro: "本题为单选模式，请选择 1 张 AI 图片。"
  },
  multiple: {
    label: "多选模式",
    shortLabel: "MULTIPLE",
    badge: "Multiple",
    rule: "SELECT EXACT",
    intro: "本题为多选模式，请选择全部 AI 图片。"
  },
  indefinite: {
    label: "不定项模式",
    shortLabel: "INDEFINITE",
    badge: "Indefinite",
    rule: "UNKNOWN COUNT",
    intro: "本题为不定项，AI 图片数量未知。"
  }
};

const selected = new Set();
let currentQuestion = null;
let visibleImages = [];
let checked = false;
let warningTimer = null;
let currentMode = "multiple";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCaseId(dateKey) {
  return `CASE-${String(dateKey).replaceAll("-", "")}`;
}

function shuffleItems(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function getQuestionMode(question) {
  return ["single", "multiple", "indefinite"].includes(question?.mode) ? question.mode : "multiple";
}

function isAiImage(image) {
  return image?.type === "ai" || image?.isAi === true;
}

function normalizeImages(images) {
  return images.map((image, index) => {
    const isAi = isAiImage(image);
    return {
      ...image,
      id: image.id || `img-${index + 1}`,
      type: image.type || (isAi ? "ai" : "real"),
      isAi,
      originalIndex: index
    };
  });
}

function getCorrectImages() {
  return visibleImages.filter((image) => isAiImage(image));
}

function getRequiredSelectionCount() {
  if (currentMode === "single") return 1;
  if (currentMode === "multiple") return getCorrectImages().length;
  return null;
}

function canSelectMore() {
  if (currentMode === "indefinite") return selected.size < visibleImages.length;
  return selected.size < getRequiredSelectionCount();
}

function setEquals(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every((item) => right.has(item));
}

function validateAnswer() {
  const answerIds = new Set(getCorrectImages().map((image) => image.id));
  return setEquals(selected, answerIds);
}

function getSampleLabel(index) {
  return ["A", "B", "C", "D"][index] || String(index + 1);
}

function initCursorSpotlight() {
  if (window.matchMedia("(pointer: coarse)").matches) return;

  let frame = 0;
  window.addEventListener("pointermove", (event) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
      frame = 0;
    });
  }, { passive: true });
}

function setStatus(title, copy, type = "") {
  statusPanel.className = `status-panel ${type}`.trim();
  statusPanel.replaceChildren();

  const marker = document.createElement("div");
  marker.className = "loading-mark";
  marker.setAttribute("aria-hidden", "true");
  marker.innerHTML = "<span></span><span></span>";

  const body = document.createElement("div");
  const label = document.createElement("p");
  const heading = document.createElement("h2");
  const text = document.createElement("p");
  label.className = "panel-label";
  label.textContent = type === "bad" ? "Collection Notice" : "Loading Collection";
  heading.textContent = title;
  text.className = "panel-copy";
  text.textContent = copy;
  body.append(label, heading, text);

  statusPanel.append(marker, body);
  statusPanel.classList.remove("is-hidden");
  gamePanel.classList.add("is-hidden");
}

function setHint(message, type = "") {
  selectionHint.textContent = message;
  selectionHint.classList.toggle("is-warning", type === "warning");
}

function showLimitFeedback(card) {
  card.classList.remove("is-limit-hit");
  void card.offsetWidth;
  card.classList.add("is-limit-hit");

  const required = getRequiredSelectionCount();
  const message = currentMode === "single"
    ? "单选模式下只能选择 1 张。点击其他样本按钮会自动改选。"
    : `本题需要选择 ${required} 张。请先取消一张，再选择新的样本。`;
  setHint(message, "warning");

  clearTimeout(warningTimer);
  warningTimer = setTimeout(updateSelectionStatus, 1800);
}

function flashSelection(card) {
  card.classList.remove("is-selecting");
  void card.offsetWidth;
  card.classList.add("is-selecting");
  window.setTimeout(() => card.classList.remove("is-selecting"), 260);
}

function getSelectionText() {
  const required = getRequiredSelectionCount();
  if (currentMode === "indefinite") return `已选择 ${selected.size} 张`;
  return `${selected.size} / ${required}`;
}

function canSubmit() {
  if (checked) return false;
  if (currentMode === "indefinite") return selected.size > 0;
  return selected.size === getRequiredSelectionCount();
}

function updateSelectionStatus() {
  const selectionText = getSelectionText();
  heroSelectionText.textContent = selectionText;
  selectionMeterText.textContent = selectionText;
  checkButton.disabled = !canSubmit();
  checkButton.classList.toggle("is-ready", canSubmit());

  document.querySelectorAll(".photo-card").forEach((card) => {
    const isSelected = selected.has(card.dataset.imageId);
    card.classList.toggle("is-selected", isSelected);
    const button = card.querySelector(".select-button");
    const state = card.querySelector(".sample-state");
    if (!button || !state || checked) return;
    button.textContent = isSelected ? "已选择" : "选择此图";
    button.classList.toggle("is-selected", isSelected);
    state.textContent = isSelected ? "SELECTED" : "SAMPLE";
  });

  if (checked) return;
  if (currentMode === "single") {
    setHint("单选模式：请选择 1 张 AI 图片。点击图片可放大查看，点击按钮才会选择。");
  } else if (currentMode === "multiple") {
    const required = getRequiredSelectionCount();
    setHint(`多选模式：请选择 ${required} 张 AI 图片。当前已选择 ${selected.size} 张。`);
  } else {
    setHint(`不定项模式：AI 图片数量未知。当前已选择 ${selected.size} 张，至少选择 1 张即可提交。`);
  }
}

function renderModeBadge(question) {
  const mode = getQuestionMode(question);
  const config = QUESTION_MODES[mode];
  currentMode = mode;
  modeLabel.textContent = config.label;
  modeBadge.textContent = config.badge;
  modeStripLabel.textContent = config.shortLabel;
  selectionRuleLabel.textContent = mode === "multiple"
    ? `SELECT ${getCorrectImages().length}`
    : config.rule;
  gamePanel.dataset.mode = mode;
  document.body.dataset.mode = mode;

  const ruleTwo = mode === "single"
    ? "本题只能选择 1 张 AI 图片。"
    : mode === "multiple"
      ? `本题需要选择 ${getCorrectImages().length} 张 AI 图片。`
      : "本题为不定项，AI 图片数量未知。";

  ruleList.innerHTML = `
    <li><span>01</span>四张样本会随机排列。</li>
    <li><span>02</span>${ruleTwo}</li>
    <li><span>03</span>点击图片放大查看，点击按钮进行选择。</li>
  `;
}

// Uses CSS variables for a restrained 3D tilt. It stays light and is skipped on touch devices.
function attachCardMotion(card) {
  if (window.matchMedia("(pointer: coarse)").matches) return;

  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--rx", `${(0.5 - y) * 5}deg`);
    card.style.setProperty("--ry", `${(x - 0.5) * 5}deg`);
  }, { passive: true });

  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

function openLightbox(image, index) {
  lightboxImage.src = image.src;
  lightboxImage.alt = `影像样本 ${getSampleLabel(index)} 大图预览`;
  lightboxTitle.textContent = `SAMPLE ${getSampleLabel(index)}`;
  lightboxCaption.textContent = "点击遮罩或按 Esc 关闭预览。选择请使用样本卡片下方按钮。";
  lightbox.classList.remove("is-hidden");
  document.body.classList.add("has-lightbox");
  lightboxClose.focus({ preventScroll: true });
}

function closeLightbox() {
  lightbox.classList.add("is-hidden");
  document.body.classList.remove("has-lightbox");
  lightboxImage.removeAttribute("src");
}

function toggleSelection(imageId, card) {
  if (checked) return;

  if (selected.has(imageId)) {
    selected.delete(imageId);
    updateSelectionStatus();
    return;
  }

  if (currentMode === "single") {
    selected.clear();
    selected.add(imageId);
    flashSelection(card);
    updateSelectionStatus();
    return;
  }

  if (!canSelectMore()) {
    showLimitFeedback(card);
    return;
  }

  selected.add(imageId);
  flashSelection(card);
  updateSelectionStatus();
}

function createPhotoCard(image, index) {
  const card = document.createElement("article");
  card.className = "photo-card";
  card.dataset.imageId = image.id;
  card.style.setProperty("--delay", `${index * 95}ms`);

  const number = document.createElement("span");
  number.className = "card-index";
  number.textContent = `S-${getSampleLabel(index)}`;

  const selectedTag = document.createElement("span");
  selectedTag.className = "selected-tag";
  selectedTag.textContent = "SELECTED";

  const previewButton = document.createElement("button");
  previewButton.className = "photo-preview-button";
  previewButton.type = "button";
  previewButton.setAttribute("aria-label", `放大查看样本 ${getSampleLabel(index)}`);

  const media = document.createElement("div");
  media.className = "photo-media";
  const img = document.createElement("img");
  img.src = image.src;
  img.alt = `影像样本 ${getSampleLabel(index)}`;
  img.loading = "eager";
  const broken = document.createElement("div");
  broken.className = "broken-state";
  broken.textContent = "影像样本暂时无法加载。请检查图片路径或稍后刷新。";
  media.append(img, broken);
  previewButton.appendChild(media);

  const footer = document.createElement("div");
  footer.className = "sample-footer";
  footer.innerHTML = `
    <div class="sample-meta">
      <span>SAMPLE ${getSampleLabel(index)}</span>
      <strong class="sample-state">SAMPLE</strong>
    </div>
  `;

  const selectButton = document.createElement("button");
  selectButton.className = "select-button";
  selectButton.type = "button";
  selectButton.textContent = "选择此图";
  footer.appendChild(selectButton);

  const identity = document.createElement("span");
  identity.className = "identity-chip";
  identity.textContent = "待鉴别";

  img.addEventListener("load", () => card.classList.add("is-loaded"));
  img.addEventListener("error", () => {
    card.classList.add("is-broken", "is-loaded");
    identity.textContent = "样本缺失";
  });

  previewButton.addEventListener("click", () => openLightbox(image, index));
  selectButton.addEventListener("click", () => toggleSelection(image.id, card));

  card.append(number, selectedTag, previewButton, identity, footer);
  attachCardMotion(card);
  return card;
}

function renderQuestion(question, shuffle = true) {
  const normalizedImages = normalizeImages(question.images);
  currentQuestion = { ...question, images: normalizedImages };
  visibleImages = shuffle ? shuffleItems(normalizedImages) : [...normalizedImages];
  checked = false;
  selected.clear();
  clearTimeout(warningTimer);
  closeLightbox();

  questionTitle.textContent = question.title || "AI 照片识别挑战";
  questionDescription.textContent = question.description || "从四张图片中找出 AI 生成的照片。点击图片可放大查看，选择需要点击样本下方按钮。";
  todayLabel.textContent = question.date;
  caseIdLabel.textContent = question.id || getCaseId(question.date);
  photoGrid.replaceChildren();
  identityList.replaceChildren();
  reportMetrics.replaceChildren();
  resultPanel.className = "result-panel is-hidden";
  resultTitle.textContent = "识别结果";
  resultStamp.textContent = "PENDING";
  resultSummary.textContent = "";

  renderModeBadge(currentQuestion);

  visibleImages.forEach((image, index) => {
    photoGrid.appendChild(createPhotoCard(image, index));
  });

  statusPanel.classList.add("is-hidden");
  gamePanel.classList.remove("is-hidden");
  updateSelectionStatus();
}

function buildReportMetrics(isRight) {
  const correctCount = getCorrectImages().length;
  const rows = [
    ["模式", QUESTION_MODES[currentMode].label],
    ["已选", `${selected.size} 张`],
    ["正确答案", `${correctCount} 张`],
    ["判定", isRight ? "完全匹配" : "需要复盘"]
  ];

  reportMetrics.replaceChildren();
  rows.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    reportMetrics.appendChild(item);
  });
}

function buildIdentityReport() {
  identityList.replaceChildren();
  const correctIds = new Set(getCorrectImages().map((image) => image.id));

  visibleImages.forEach((image, index) => {
    const wasSelected = selected.has(image.id);
    const isCorrect = correctIds.has(image.id);
    const item = document.createElement("div");
    item.className = `identity-item ${isCorrect ? "is-ai" : "is-real"} ${wasSelected ? "is-selected" : ""} ${wasSelected && !isCorrect ? "is-wrong" : ""} ${!wasSelected && isCorrect ? "is-missed" : ""}`;

    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = `SAMPLE ${getSampleLabel(index)}`;
    value.textContent = isCorrect ? "AI 生成" : "真实照片";
    item.append(label, value);

    const mark = document.createElement("em");
    if (wasSelected && isCorrect) {
      mark.textContent = "你的选择 / 正确答案";
    } else if (wasSelected && !isCorrect) {
      mark.textContent = "错误选择";
    } else if (!wasSelected && isCorrect) {
      mark.textContent = "正确答案";
    } else {
      mark.textContent = "未选择";
    }
    item.appendChild(mark);
    identityList.appendChild(item);
  });
}

function revealResult() {
  if (!canSubmit()) {
    updateSelectionStatus();
    setHint("当前选择数量还不符合本题提交条件。", "warning");
    return;
  }

  checked = true;
  const isRight = validateAnswer();
  const correctIds = new Set(getCorrectImages().map((image) => image.id));
  const cards = [...document.querySelectorAll(".photo-card")];

  resultPanel.className = `result-panel ${isRight ? "is-success" : "is-fail"}`;
  resultTitle.textContent = isRight ? "识别成功" : "识别失败";
  resultStamp.textContent = isRight ? "MATCHED" : "REVIEW";
  resultSummary.textContent = isRight
    ? "你成功从四张影像中辨认出 AI 生成样本。下方报告列出你的选择与真实答案。"
    : "部分影像伪装得很接近真实拍摄。再观察纹理、光线与边缘细节，下方报告已揭晓真实答案。";
  buildReportMetrics(isRight);
  buildIdentityReport();

  cards.forEach((card, index) => {
    window.setTimeout(() => {
      const image = visibleImages[index];
      const isCorrect = correctIds.has(image.id);
      const wasSelected = selected.has(image.id);
      const identity = card.querySelector(".identity-chip");
      const button = card.querySelector(".select-button");
      const state = card.querySelector(".sample-state");

      card.classList.add(isCorrect ? "is-ai-reveal" : "is-real-reveal");
      card.classList.toggle("is-wrong-choice", wasSelected && !isCorrect);
      card.classList.toggle("is-missed-choice", !wasSelected && isCorrect);
      identity.textContent = isCorrect ? "AI 生成" : "真实照片";
      state.textContent = "REVEALED";
      button.disabled = true;
      button.textContent = wasSelected && isCorrect
        ? "选择正确"
        : wasSelected && !isCorrect
          ? "错误选择"
          : isCorrect
            ? "正确答案"
            : "真实照片";
    }, index * 150);
  });

  updateSelectionStatus();
}

function resetChallenge() {
  if (!currentQuestion) return;

  closeLightbox();
  const rerender = () => renderQuestion(currentQuestion, true);
  if (resultPanel.classList.contains("is-hidden")) {
    rerender();
    return;
  }

  resultPanel.classList.add("is-leaving");
  window.setTimeout(rerender, 190);
}

function getFetchFailureMessage(error) {
  const localHint = "无法读取题库。如果你正在本地预览，请使用 python -m http.server 5178 启动本地服务器后访问 http://127.0.0.1:5178/。部署到 GitHub Pages 后会正常读取。";
  const message = error?.message || "";
  if (window.location.protocol === "file:" || /failed to fetch|networkerror|load failed/i.test(message)) {
    return localHint;
  }
  return message || "请检查 data/questions.json 是否存在并且格式正确。";
}

async function loadQuestion() {
  const today = getLocalDateKey();
  todayLabel.textContent = today;
  caseIdLabel.textContent = getCaseId(today);
  setStatus("正在读取今天的题目", "正在连接题库并准备今日影像样本。");

  try {
    const response = await fetch(`data/questions.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`题库读取失败：HTTP ${response.status}`);

    const data = await response.json();
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const question = questions.find((item) => item.date === today || item.id === today);

    if (!question) {
      setStatus("今日暂未开馆", `今天（${today}）还没有题目。管理员发布后，同学刷新本页即可看到。`);
      return;
    }

    if (!Array.isArray(question.images) || question.images.length !== 4) {
      setStatus("今日题目数据不完整", "题库中需要正好 4 张图片，请管理员检查 data/questions.json。", "bad");
      return;
    }

    renderQuestion(question, true);
  } catch (error) {
    setStatus("无法读取题库", getFetchFailureMessage(error), "bad");
  }
}

initCursorSpotlight();
checkButton.addEventListener("click", revealResult);
resetButton.addEventListener("click", resetChallenge);
lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.classList.contains("is-hidden")) closeLightbox();
});

loadQuestion();
