# AI 照片识别挑战

一个纯静态网页小游戏，适合部署到 GitHub Pages：

- 同学打开 `index.html`，网页读取 `data/questions.json`，显示当天题目。
- 管理员打开 `admin.html`，输入 GitHub Token，上传 4 张图片并标记其中 2 张 AI 图片。
- 管理员页会把图片上传到 `media/YYYY-MM-DD/`，并把当天题目写回 `data/questions.json`。

## 本次界面能力

- 学生页升级为“AI 影像鉴别实验室 / 数字暗房”视觉，支持动态背景、样本卡入场动画、最多选择两张的交互反馈、提交后的身份揭晓与分析报告。
- 如果直接双击 `index.html` 导致浏览器无法读取题库，页面会提示使用本地服务器预览。
- 管理员页支持点击选择图片，也支持把图片拖拽到每张上传卡片中，并显示发布日志。
- 拖拽上传只接受图片文件；拖入新图片会替换旧图片，并立即显示预览。
- 发布过程会显示校验、读取题库、逐张上传、更新题目数据、发布完成等进度。

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

`data/questions.json` 的核心结构保持不变：

```json
{
  "questions": [
    {
      "date": "2026-06-21",
      "title": "哪两张是 AI 生成的？",
      "images": [
        { "src": "media/2026-06-21/example-01.jpg", "isAi": true },
        { "src": "media/2026-06-21/example-02.jpg", "isAi": false },
        { "src": "media/2026-06-21/example-03.jpg", "isAi": true },
        { "src": "media/2026-06-21/example-04.jpg", "isAi": false }
      ]
    }
  ]
}
```
