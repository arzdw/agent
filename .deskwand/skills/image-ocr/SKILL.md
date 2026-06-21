---
name: image-ocr
version: 2.0.0
description: "本地离线 OCR 文字识别，基于 tesseract.js。当用户发图片/截图/扫描件要求提取文字时使用，支持中英文。纯本地运行，无需联网。"
allowed-tools: "read,shell"
requires:
  npm: ["tesseract.js"]
metadata:
  tags: [OCR, Images, Text-Extraction, Screenshots, Documents]
---

# Image OCR (v2)

基于 tesseract.js（WASM）的本地离线 OCR，零系统依赖。

语言包（~30MB）**首次使用自动从 S3 下载**，缓存到本地后离线可用。

## 触发条件

当用户提供图片并要求识别其中文字时触发：
- 「识别这张图」「OCR 一下」「图片里写了什么」「提取文字」「帮我看看这张截图」
- 截图 / 照片 / 扫描件 / PDF 页面，任意图片格式
- 中英文混合内容

## 使用方式

### 识别单张图片

```bash
node <skill-path>/scripts/ocr.js <image-path>
```

首次运行会自动下载中英文语言包，约 30MB，只需一次。

### 指定语言

```bash
# 仅英文
node <skill-path>/scripts/ocr.js <image-path> --lang=eng

# 仅中文
node <skill-path>/scripts/ocr.js <image-path> --lang=chi_sim

# 中英混合（默认）
node <skill-path>/scripts/ocr.js <image-path> --lang=chi_sim+eng
```

### 输出 JSON（含置信度）

```bash
node <skill-path>/scripts/ocr.js <image-path> --json
```

## 识别 PDF

1. 用 `shell` 工具将 PDF 每页转为 PNG
2. 逐页运行 `node .../scripts/ocr.js <page-N.png>`

## 注意事项

- 图片质量直接影响准确率，模糊图片需提前提醒用户
- 手写体效果较差，务必告知用户
- 不要脑补/编造图片中不存在的文字
