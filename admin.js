const form = document.querySelector("#adminForm");
const tokenInput = document.querySelector("#tokenInput");
const ownerInput = document.querySelector("#ownerInput");
const repoInput = document.querySelector("#repoInput");
const branchInput = document.querySelector("#branchInput");
const dateInput = document.querySelector("#dateInput");
const titleInput = document.querySelector("#titleInput");
const fileInputs = [...document.querySelectorAll(".file-input")];
const aiChecks = [...document.querySelectorAll(".ai-check")];
const previews = [...document.querySelectorAll(".preview")];
const publishButton = document.querySelector("#publishButton");
const adminStatus = document.querySelector("#adminStatus");

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setAdminStatus(message, type = "") {
  adminStatus.textContent = message;
  adminStatus.className = `result ${type}`;
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
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.message || `GitHub 请求失败：${response.status}`);
  }
  return body;
}

async function getContent(owner, repo, branch, token, path) {
  try {
    return await githubRequest(`${apiUrl(owner, repo, path)}?ref=${encodeURIComponent(branch)}`, token);
  } catch (error) {
    if (error.message.includes("Not Found")) return null;
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

function validateForm() {
  const files = fileInputs.map((input) => input.files[0]).filter(Boolean);
  const aiCount = aiChecks.filter((input) => input.checked).length;

  if (files.length !== 4) throw new Error("请上传正好 4 张图片。");
  if (aiCount !== 2) throw new Error("请勾选正好 2 张 AI 图片。");
  if (!tokenInput.value.trim()) throw new Error("请输入 GitHub Token。");
  if (!ownerInput.value.trim() || !repoInput.value.trim() || !branchInput.value.trim()) {
    throw new Error("请填写 GitHub 仓库信息。");
  }
}

fileInputs.forEach((input, index) => {
  input.addEventListener("change", () => {
    const file = input.files[0];
    const preview = previews[index];
    preview.classList.remove("has-image");
    preview.removeAttribute("src");

    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.classList.add("has-image");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    validateForm();
    saveSettings();
    publishButton.disabled = true;

    const token = tokenInput.value.trim();
    const owner = ownerInput.value.trim();
    const repo = repoInput.value.trim();
    const branch = branchInput.value.trim();
    const date = dateInput.value;
    const title = titleInput.value.trim();
    const submissionId = Date.now();

    setAdminStatus("正在上传 4 张图片...");
    const uploadedPaths = [];
    for (const [index, input] of fileInputs.entries()) {
      const src = await uploadImage({
        owner,
        repo,
        branch,
        token,
        file: input.files[0],
        index,
        date,
        submissionId
      });
      uploadedPaths.push(src);
      setAdminStatus(`已上传 ${index + 1}/4 张图片...`);
    }

    setAdminStatus("正在更新题库 JSON...");
    const { existing, data } = await readQuestions(owner, repo, branch, token);
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

    setAdminStatus("提交完成。同学刷新页面后就能看到新题，GitHub Pages 可能需要等几十秒。", "ok");
  } catch (error) {
    setAdminStatus(error.message, "bad");
  } finally {
    publishButton.disabled = false;
  }
});

loadSavedSettings();
