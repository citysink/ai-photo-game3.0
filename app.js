const statusPanel = document.querySelector("#statusPanel");
const gamePanel = document.querySelector("#gamePanel");
const todayLabel = document.querySelector("#todayLabel");
const caseIdLabel = document.querySelector("#caseIdLabel");
const questionTitle = document.querySelector("#questionTitle");
const photoGrid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const selectedCountHero = document.querySelector("#selectedCountHero");
const selectionHint = document.querySelector("#selectionHint");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultStamp = document.querySelector("#resultStamp");
const resultSummary = document.querySelector("#resultSummary");
const identityList = document.querySelector("#identityList");

const selected = new Set();
let currentQuestion = null;
let visibleImages = [];
let checked = false;
let warningTimer = null;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCaseId(dateKey) {
  return `CASE-${dateKey.replaceAll("-", "")}`;
}

function shuffleItems(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
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
  setHint("最多只能选择两张。先取消一张，再选择新的照片。", "warning");
  clearTimeout(warningTimer);
  warningTimer = setTimeout(() => {
    if (!checked) setHint("请选择两张你认为由 AI 生成的照片。");
  }, 1800);
}

function flashSelection(card) {
  card.classList.remove("is-selecting");
  void card.offsetWidth;
  card.classList.add("is-selecting");
  window.setTimeout(() => card.classList.remove("is-selecting"), 260);
}

function updateSelectionState() {
  selectedCount.textContent = String(selected.size);
  selectedCountHero.textContent = String(selected.size);
  checkButton.disabled = selected.size !== 2 || checked;
  checkButton.classList.toggle("is-ready", selected.size === 2 && !checked);

  document.querySelectorAll(".photo-card").forEach((card, index) => {
    card.classList.toggle("is-selected", selected.has(index));
  });

  if (!checked && selected.size === 2) {
    setHint("Selection 2 / 2。样本已锁定，可以提交分析。");
  } else if (!checked) {
    setHint(`Selection ${selected.size} / 2。请选择两张你认为由 AI 生成的照片。`);
  }
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

function getSampleLabel(index) {
  return ["A", "B", "C", "D"][index] || String(index + 1);
}

function createPhotoCard(image, index) {
  const card = document.createElement("button");
  card.className = "photo-card";
  card.type = "button";
  card.style.setProperty("--delay", `${index * 95}ms`);
  card.setAttribute("aria-label", `选择样本 ${getSampleLabel(index)}`);

  const number = document.createElement("span");
  number.className = "card-index";
  number.textContent = `S-${getSampleLabel(index)}`;

  const selectedTag = document.createElement("span");
  selectedTag.className = "selected-tag";
  selectedTag.textContent = "SELECTED";

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

  const identity = document.createElement("span");
  identity.className = "identity-chip";
  identity.textContent = "待鉴别";

  img.addEventListener("load", () => card.classList.add("is-loaded"));
  img.addEventListener("error", () => {
    card.classList.add("is-broken", "is-loaded");
    identity.textContent = "样本缺失";
  });

  card.append(number, selectedTag, media, identity);

  card.addEventListener("click", () => {
    if (checked) return;

    if (selected.has(index)) {
      selected.delete(index);
    } else if (selected.size < 2) {
      selected.add(index);
      flashSelection(card);
    } else {
      showLimitFeedback(card);
      return;
    }

    updateSelectionState();
  });

  attachCardMotion(card);
  return card;
}

function renderQuestion(question, shuffle = true) {
  currentQuestion = question;
  visibleImages = (shuffle ? shuffleItems(question.images) : [...question.images]).map((image, index) => ({
    ...image,
    originalIndex: image.originalIndex ?? index
  }));
  checked = false;
  selected.clear();
  clearTimeout(warningTimer);

  questionTitle.textContent = question.title || "哪两张是 AI 生成的？";
  todayLabel.textContent = question.date;
  caseIdLabel.textContent = getCaseId(question.date);
  photoGrid.replaceChildren();
  identityList.replaceChildren();
  resultPanel.className = "result-panel is-hidden";
  resultTitle.textContent = "识别结果";
  resultStamp.textContent = "PENDING";
  resultSummary.textContent = "";

  visibleImages.forEach((image, index) => {
    photoGrid.appendChild(createPhotoCard(image, index));
  });

  statusPanel.classList.add("is-hidden");
  gamePanel.classList.remove("is-hidden");
  updateSelectionState();
}

function buildIdentityReport() {
  identityList.replaceChildren();

  visibleImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = `identity-item ${image.isAi ? "is-ai" : "is-real"} ${selected.has(index) ? "is-selected" : ""}`;
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = `SAMPLE ${getSampleLabel(index)}`;
    value.textContent = image.isAi ? "AI 生成" : "真实照片";
    item.append(label, value);

    if (selected.has(index)) {
      const mark = document.createElement("em");
      mark.textContent = "你的选择";
      item.appendChild(mark);
    }

    identityList.appendChild(item);
  });
}

function revealResult() {
  if (!currentQuestion || selected.size !== 2) {
    setHint("请先选择两张照片，再提交答案。", "warning");
    return;
  }

  checked = true;
  const aiIndexes = visibleImages
    .map((image, index) => image.isAi ? index : -1)
    .filter((index) => index >= 0);
  const isRight = aiIndexes.length === 2 && aiIndexes.every((index) => selected.has(index));
  const cards = [...document.querySelectorAll(".photo-card")];

  resultPanel.className = `result-panel ${isRight ? "is-success" : "is-fail"}`;
  resultTitle.textContent = isRight ? "识别成功" : "识别失败";
  resultStamp.textContent = isRight ? "MATCHED" : "REVIEW";
  resultSummary.textContent = isRight
    ? "你成功从四张影像中辨认出 AI 生成样本。下方报告列出你的选择与真实答案。"
    : "部分影像伪装得很接近真实拍摄。再观察纹理、光线与边缘细节，下方报告已揭晓真实答案。";
  buildIdentityReport();

  cards.forEach((card, index) => {
    window.setTimeout(() => {
      const image = visibleImages[index];
      const identity = card.querySelector(".identity-chip");
      card.classList.add(image.isAi ? "is-ai-reveal" : "is-real-reveal");
      card.classList.toggle("is-wrong-choice", selected.has(index) && !image.isAi);
      identity.textContent = image.isAi ? "AI 生成" : "真实照片";
    }, index * 150);
  });

  updateSelectionState();
}

function resetChallenge() {
  if (!currentQuestion) return;

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
    const question = questions.find((item) => item.date === today);

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

loadQuestion();
