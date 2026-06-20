# AI 照片识别挑战

一个纯静态网页小游戏，适合部署到 GitHub Pages：

- 同学打开 `index.html`，网页读取 `data/questions.json`，显示当天题目。
- 管理员打开 `admin.html`，输入 GitHub Token，上传 4 张图片，选择出题模式并标记 AI 图片。
- 管理员页会把图片上传到 `media/YYYY-MM-DD/`，并把当天题目写回 `data/questions.json`。

## 当前能力

- 学生页支持“单选 / 多选 / 不定项”三种题型。
- 学生页点击图片会打开大图预览；只有点击图片下方的“选择此图”按钮才会改变选择状态。
- 学生页会根据题型自动调整选择数量、提示文案、提交按钮状态和结果判定。
- 管理员页支持点击选择图片，也支持把图片拖拽到每张上传卡片中。
- 管理员页发布题目时需要选择出题模式，并会按模式校验 AI 图片数量。
- 发布过程会显示校验、读取题库、逐张上传、更新题目数据、发布完成等日志。

## 出题模式

- 单选：必须且只能设置 1 张 AI 图片，学生只能选择 1 张。
- 多选：至少设置 2 张 AI 图片，学生必须选满正确答案数量。
- 不定项：设置 1 到 4 张 AI 图片，学生不知道正确答案数量，选择非空即可提交。

旧题目如果没有 `mode` 字段，会默认按多选模式处理；旧的 `isAi` 字段仍然兼容。

## 部署

1. 把本项目推送到 GitHub 仓库。
2. 在仓库的 Settings -> Pages 中启用 GitHub Pages。
3. 同学访问 GitHub Pages 的 `index.html`。
4. 管理员访问同一个站点的 `admin.html`。

## Token 权限

管理员需要 GitHub Personal Access Token。建议使用 fine-grained token，并只给这个仓库：

- Repository permissions -> Contents: Read and write

Token 只在浏览器本次页面里使用，不会写入题库或代码文件。公共电脑上用完请关闭页面。

## 本地预览

`index.html` 需要通过本地服务读取 `data/questions.json`，不要直接双击文件打开。可以在项目目录运行：

```bash
python -m http.server 5178
```

然后访问：

```text
http://127.0.0.1:5178/
```

## 题库格式

新题目会写入 `mode`、`description`、图片 `id/type`，并保留 `isAi` 兼容字段：

```json
{
  "questions": [
    {
      "id": "2026-06-21",
      "date": "2026-06-21",
      "title": "AI 照片识别挑战",
      "description": "从四张图片中找出 AI 生成的照片。",
      "mode": "multiple",
      "images": [
        { "id": "img-1", "src": "media/2026-06-21/example-01.jpg", "type": "ai", "isAi": true },
        { "id": "img-2", "src": "media/2026-06-21/example-02.jpg", "type": "real", "isAi": false }
      ]
    }
  ]
}
```
