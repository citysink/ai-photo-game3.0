# AI 图片辨别挑战

一个纯静态网页小游戏：

- 同学打开 `index.html`，网页读取 `data/questions.json`，显示当天题目。
- 管理员打开 `admin.html`，输入 GitHub Token，上传 4 张图片并标记其中 2 张 AI 图片。
- 管理员页会把图片上传到 `media/YYYY-MM-DD/`，并把当天题目写回 `data/questions.json`。

## 部署

1. 把本项目推送到 GitHub 仓库。
2. 在仓库的 Settings -> Pages 中启用 GitHub Pages。
3. 同学访问 GitHub Pages 的 `index.html`。
4. 管理员访问同一个站点的 `admin.html`。

## Token 权限

管理员需要 GitHub Personal Access Token。建议使用 fine-grained token，并只给这个仓库：

- Repository permissions -> Contents: Read and write

Token 只在浏览器本次页面里使用，不会写入题库。公共电脑上用完请关闭页面。

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
