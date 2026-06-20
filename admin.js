const form = document.querySelector("#adminForm");
const tokenInput = document.querySelector("#tokenInput");
const ownerInput = document.querySelector("#ownerInput");
const repoInput = document.querySelector("#repoInput");
const branchInput = document.querySelector("#branchInput");
const dateInput = document.querySelector("#dateInput");
const titleInput = document.querySelector("#titleInput");
const fileInputs = [...document.querySelectorAll(".file-input")];
const aiChecks = [...document.querySelectorAll(".ai-check")];
const uploadCards = [...document.querySelectorAll(".upload-card")];
const previews = [...document.querySelectorAll(".preview")];
const fileNames = [...document.querySelectorAll(".file-name")];
const fileStates = [...document.querySelectorAll(".file-state")];
const clearButtons = [...document.querySelectorAll(".clear-file")];
const publishButton = document.querySelector("#publishButton");
const adminStatus = document.querySelector("#adminStatus");
const aiCountText = document.querySelector("#aiCountText");
const publishLog = document.querySelector("#publishLog");

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const selectedFiles = Array(fileInputs.length).fill(null);
const previewUrls = Array(fileInputs.length).fill("");

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setAdminStatus(message, type = "") {
  adminStatus.textContent = message;
  adminStatus.className = `result ${type}`.trim();
  appendPublishLog(message, type);
}

function appendPublishLog(message, type = "") {
  if (!publishLog) return;

  const time = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const item = document.createElement("div");
  const stamp = document.createElement("span");
  const text = document.createElement("strong");
  stamp.textContent = time;
  text.className = type;
  text.textContent = message;
  item.append(stamp, text);
  publishLog.appendChild(item);
  publishLog.scrollTop = publishLog.scrollHeight;
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

function inferRepoFromLocation() {
  const host = window.location.hostname;
  const parts = window.location.pathname.split("/").filter(Boolean);

  if (host.endsWith(".github.io")) {
    const owner = host.replace(".github.io", "");
    const repo = parts[0] || `${owner}.github.io`;
    return { owner, repo };
  }

  return { owner: "", repo: "" };
}

function loadSavedSettings() {
  const inferred = inferRepoFromLocation();
  ownerInput.value = localStorage.getItem("photoGameOwner") || inferred.owner;
  repoInput.value = localStorage.getItem("photoGameRepo") || inferred.repo;
  branchInput.value = localStorage.getItem("photoGameBranch") || "main";
  dateInput.value = getLocalDateKey();
}

function saveSettings() {
  localStorage.setItem("photoGameOwner", ownerInput.value.trim());
  localStorage.setItem("photoGameRepo", repoInput.value.trim());
  localStorage.setItem("photoGameBranch", branchInput.value.trim());
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToText(base64) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return decoder.decode(bytes);
}

function textToBase64(text) {
  return bytesToBase64(encoder.encode(text));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function cleanFileName(name) {
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "jpg";
  return extension.replace(/[^a-z0-9]/g, "") || "jpg";
}

function apiUrl(owner, repo, path) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function formatGitHubError(status, message) {
  if (/bad credentials/i.test(message)) {
    return "Token 错误：GitHub 返回 Bad credentials，请检查 Token 是否复制完整或已过期。";
  }

  if (/resource not accessible by personal access token/i.test(message)) {
    return "Token 权限不足：请给该仓库开启 Contents: Read and write 权限。";
  }

  if (status === 404 || /not found/i.test(message)) {
    return "GitHub 返回 404：请检查 owner、repo、branch 是否正确，以及仓库路径是否存在。";
  }

  if (status === 409) {
    return "文件冲突：远端文件刚刚被更新，请刷新管理员页后重试。";
  }

  return message || `GitHub 请求失败：${status}`;
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const rawMessage = body?.message || text || `GitHub 请求失败：${response.status}`;
    const error = new Error(formatGitHubError(response.status, rawMessage));
    error.status = response.status;
    error.rawMessage = rawMessage;
    throw error;
  }

  return body;
}

async function getContent(owner, repo, branch, token, path) {
  try {
    return await githubRequest(`${apiUrl(owner, repo, path)}?ref=${encodeURIComponent(branch)}`, token);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function putContent({ owner, repo, branch, token, path, content, message, sha }) {
  return githubRequest(apiUrl(owner, repo, path), token, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content,
      branch,
      ...(sha ? { sha } : {})
    })
  });
}

async function uploadImage({ owner, repo, branch, token, file, index, date, submissionId }) {
  const extension = cleanFileName(file.name);
  const path = `media/${date}/${submissionId}-${String(index + 1).padStart(2, "0")}.${extension}`;
  const existing = await getContent(owner, repo, branch, token, path);
  const content = await fileToBase64(file);

  await putContent({
    owner,
    repo,
    branch,
    token,
    path,
    content,
    sha: existing?.sha,
    message: `Upload ${date} image ${index + 1}`
  });

  return path;
}

async function readQuestions(owner, repo, branch, token) {
  const existing = await getContent(owner, repo, branch, token, "data/questions.json");
  if (!existing) {
    return { existing: null, data: { questions: [] } };
  }

  const text = base64ToText(existing.content || "");
  const data = JSON.parse(text);
  if (!Array.isArray(data.questions)) data.questions = [];
  return { existing, data };
}

function normalizeDateValue(value) {
  const normalized = value.trim().replace(/[/.]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new Error("题目日期请使用 YYYY-MM-DD 格式。");

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const date = new Date(`${year}-${month}-${day}T00:00:00`);

  if (Number.isNaN(date.getTime()) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) {
    throw new Error("题目日期无效，请检查年月日。");
  }

  return `${year}-${month}-${day}`;
}

function updateAiCount() {
  const aiCount = aiChecks.filter((input) => input.checked).length;
  aiCountText.textContent = `AI 已标记 ${aiCount} / 2`;
  aiCountText.classList.toggle("is-complete", aiCount === 2);
}

function markCardError(index, message) {
  const card = uploadCards[index];
  card.classList.add("is-error");
  setAdminStatus(message, "bad");
  window.setTimeout(() => card.classList.remove("is-error"), 1200);
}

function getSampleName(index) {
  return ["SAMPLE A", "SAMPLE B", "SAMPLE C", "SAMPLE D"][index] || `SAMPLE ${index + 1}`;
}

function syncInputFile(index, file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputs[index].files = transfer.files;
  } catch {
    // The selectedFiles array is the source of truth when a browser blocks DataTransfer assignment.
  }
}

// Handles both file picker and drag-drop replacement while preserving the original file input.
function acceptImageFile(index, file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    markCardError(index, `${getSampleName(index)} 只接受图片文件。`);
    return;
  }

  if (previewUrls[index]) URL.revokeObjectURL(previewUrls[index]);
  previewUrls[index] = URL.createObjectURL(file);
  selectedFiles[index] = file;
  syncInputFile(index, file);

  previews[index].src = previewUrls[index];
  previews[index].classList.add("has-image");
  fileNames[index].textContent = file.name;
  fileStates[index].textContent = "已选择";
  uploadCards[index].classList.remove("is-error");
  setAdminStatus(`${getSampleName(index)} 已就绪。`);
}

function clearImageFile(index) {
  if (previewUrls[index]) URL.revokeObjectURL(previewUrls[index]);
  previewUrls[index] = "";
  selectedFiles[index] = null;
  fileInputs[index].value = "";
  previews[index].removeAttribute("src");
  previews[index].classList.remove("has-image");
  fileNames[index].textContent = "等待上传";
  fileStates[index].textContent = "未选择";
  setAdminStatus(`已移除 ${getSampleName(index)}。`);
}

function validateForm() {
  const token = tokenInput.value.trim();
  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const branch = branchInput.value.trim();
  const date = normalizeDateValue(dateInput.value);
  const title = titleInput.value.trim();
  const missingImages = selectedFiles
    .map((file, index) => file ? "" : `IMAGE ${String(index + 1).padStart(2, "0")}`)
    .filter(Boolean);
  const aiCount = aiChecks.filter((input) => input.checked).length;

  if (!token) throw new Error("请先输入 GitHub Token。");
  if (!owner) throw new Error("请填写 Owner。");
  if (!repo) throw new Error("请填写 Repo。");
  if (!branch) throw new Error("请填写 Branch。");
  if (!title) throw new Error("请填写题目标题。");
  if (missingImages.length > 0) throw new Error(`请补齐四张图片：${missingImages.join("、")}。`);
  if (aiCount !== 2) throw new Error(`请标记正好 2 张 AI 图片，当前标记了 ${aiCount} 张。`);

  return { token, owner, repo, branch, date, title };
}

fileInputs.forEach((input, index) => {
  input.addEventListener("change", () => acceptImageFile(index, input.files[0]));
});

uploadCards.forEach((card, index) => {
  card.addEventListener("dragenter", (event) => {
    event.preventDefault();
    card.classList.add("is-drag-over");
  });

  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    card.classList.add("is-drag-over");
  });

  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) {
      card.classList.remove("is-drag-over");
    }
  });

  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("is-drag-over");
    acceptImageFile(index, event.dataTransfer.files[0]);
  });
});

clearButtons.forEach((button, index) => {
  button.addEventListener("click", () => clearImageFile(index));
});

aiChecks.forEach((input) => {
  input.addEventListener("change", updateAiCount);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  let publishSucceeded = false;
  try {
    publishButton.disabled = true;
    publishButton.classList.remove("is-success");
    publishButton.textContent = "发布中...";

    setAdminStatus("正在校验配置...", "loading");
    const { token, owner, repo, branch, date, title } = validateForm();
    dateInput.value = date;
    saveSettings();

    setAdminStatus("正在读取 questions.json...", "loading");
    const { existing, data } = await readQuestions(owner, repo, branch, token);

    const submissionId = Date.now();
    const uploadedPaths = [];
    for (const [index, file] of selectedFiles.entries()) {
      setAdminStatus(`正在上传 ${getSampleName(index)}...`, "loading");
      const src = await uploadImage({
        owner,
        repo,
        branch,
        token,
        file,
        index,
        date,
        submissionId
      });
      uploadedPaths.push(src);
    }

    setAdminStatus("正在更新题目数据...", "loading");
    const nextQuestion = {
      date,
      title,
      images: uploadedPaths.map((src, index) => ({
        src,
        isAi: aiChecks[index].checked
      })),
      updatedAt: new Date().toISOString()
    };

    const previousIndex = data.questions.findIndex((item) => item.date === date);
    if (previousIndex >= 0) {
      data.questions[previousIndex] = nextQuestion;
    } else {
      data.questions.push(nextQuestion);
    }

    data.questions.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    await putContent({
      owner,
      repo,
      branch,
      token,
      path: "data/questions.json",
      content: textToBase64(`${JSON.stringify(data, null, 2)}\n`),
      sha: existing?.sha,
      message: `Update photo question for ${date}`
    });

    publishSucceeded = true;
    publishButton.classList.add("is-success");
    publishButton.textContent = "发布完成";
    setAdminStatus("发布完成。同学刷新页面后就能看到新题，GitHub Pages 可能需要几十秒同步。", "ok");
  } catch (error) {
    setAdminStatus(error.message, "bad");
  } finally {
    publishButton.disabled = false;
    if (!publishSucceeded) {
      publishButton.textContent = "发布到 GitHub";
      publishButton.classList.remove("is-success");
    }
  }
});

initCursorSpotlight();
loadSavedSettings();
updateAiCount();
