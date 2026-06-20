const statusPanel = document.querySelector("#statusPanel");
const gamePanel = document.querySelector("#gamePanel");
const todayLabel = document.querySelector("#todayLabel");
const questionTitle = document.querySelector("#questionTitle");
const photoGrid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");
const resultText = document.querySelector("#resultText");

const selected = new Set();
let currentQuestion = null;
let checked = false;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setStatus(message, type = "") {
  statusPanel.innerHTML = `<p class="result ${type}">${message}</p>`;
}

function updateSelectionState() {
  selectedCount.textContent = String(selected.size);
  checkButton.disabled = selected.size !== 2 || checked;

  document.querySelectorAll(".photo-card").forEach((card, index) => {
    card.classList.toggle("is-selected", selected.has(index));
  });
}

function renderQuestion(question) {
  currentQuestion = question;
  selected.clear();
  checked = false;
  questionTitle.textContent = question.title || "哪两张是 AI 生成的？";
  todayLabel.textContent = question.date;
  photoGrid.innerHTML = "";
  resultText.textContent = "";
  resultText.className = "result";

  question.images.forEach((image, index) => {
    const button = document.createElement("button");
    button.className = "photo-card";
    button.type = "button";
    button.setAttribute("aria-label", `选择图片 ${index + 1}`);
    button.innerHTML = `
      <span class="badge">${index + 1}</span>
      <img src="${image.src}" alt="题目图片 ${index + 1}">
    `;

    button.addEventListener("click", () => {
      if (checked) return;
      if (selected.has(index)) {
        selected.delete(index);
      } else if (selected.size < 2) {
        selected.add(index);
      }
      updateSelectionState();
    });

    photoGrid.appendChild(button);
  });

  statusPanel.classList.add("is-hidden");
  gamePanel.classList.remove("is-hidden");
  updateSelectionState();
}

async function loadQuestion() {
  const today = getLocalDateKey();
  todayLabel.textContent = today;

  try {
    const response = await fetch(`data/questions.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("题库读取失败");

    const data = await response.json();
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const question = questions.find((item) => item.date === today);

    if (!question) {
      setStatus(`今天（${today}）还没有题目。管理员上传后，同学刷新本页即可看到。`);
      return;
    }

    if (!Array.isArray(question.images) || question.images.length !== 4) {
      setStatus("今天的题目数据不完整，需要 4 张图片。", "bad");
      return;
    }

    renderQuestion(question);
  } catch (error) {
    setStatus(`无法读取题库：${error.message}`, "bad");
  }
}

checkButton.addEventListener("click", () => {
  if (!currentQuestion || selected.size !== 2) return;

  checked = true;
  const aiIndexes = currentQuestion.images
    .map((image, index) => image.isAi ? index : -1)
    .filter((index) => index >= 0);

  const isRight = aiIndexes.every((index) => selected.has(index));

  document.querySelectorAll(".photo-card").forEach((card, index) => {
    const isAi = aiIndexes.includes(index);
    card.classList.toggle("is-correct", isAi);
    card.classList.toggle("is-wrong", selected.has(index) && !isAi);
  });

  resultText.textContent = isRight ? "答对了！这两张就是 AI 图片。" : "还差一点，绿色边框是真正的 AI 图片。";
  resultText.className = `result ${isRight ? "ok" : "bad"}`;
  updateSelectionState();
});

resetButton.addEventListener("click", () => {
  checked = false;
  selected.clear();
  resultText.textContent = "";
  resultText.className = "result";
  document.querySelectorAll(".photo-card").forEach((card) => {
    card.classList.remove("is-correct", "is-wrong", "is-selected");
  });
  updateSelectionState();
});

loadQuestion();
