#!/usr/bin/env node
/**
 * image-ocr v2 — tesseract.js 本地 OCR
 *
 * 语言包（~30MB）首次使用时从 S3 自动下载到 ~/.deskwand/skills/image-ocr/models/
 * 之后离线可用。
 *
 * 用法:
 *   node ocr.js <image-path>                  # 中英混合识别
 *   node ocr.js <image-path> --lang=eng       # 仅英文
 *   node ocr.js <image-path> --json           # JSON 输出（含置信度）
 */

const { createWorker } = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const { pipeline } = require("stream/promises");

// ─── 配置 ───────────────────────────────────────────────
const MODELS = {
  chi_sim: "chi_sim.traineddata.gz",
  eng: "eng.traineddata.gz",
};

// S3 下载地址
const DOWNLOAD_BASE =
  "https://file.deskwand.com/skills/image-ocr/models";

// 本地缓存目录
const CACHE_DIR = path.join(os.homedir(), ".deskwand", "skills", "image-ocr", "models");

// 语言列表 → 文件名列表
const LANG_TO_FILES = {
  chi_sim: ["chi_sim.traineddata.gz"],
  eng: ["eng.traineddata.gz"],
  "chi_sim+eng": ["chi_sim.traineddata.gz", "eng.traineddata.gz"],
};

// ─── 下载 ───────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          https.get(res.headers.location, (r2) => {
            const chunks = [];
            r2.on("data", (c) => chunks.push(c));
            r2.on("end", () => resolve(Buffer.concat(chunks)));
            r2.on("error", reject);
          }).on("error", reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function ensureModels(models) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  for (const f of models) {
    const dest = path.join(CACHE_DIR, f);
    if (fs.existsSync(dest)) continue;

    const url = `${DOWNLOAD_BASE}/${f}`;
    process.stderr.write(`[image-ocr] 首次使用，下载语言包: ${f} ... `);
    try {
      const data = await httpGet(url);
      fs.writeFileSync(dest, data);
      process.stderr.write(`完成 (${(data.length / 1024 / 1024).toFixed(1)}MB)\n`);
    } catch (e) {
      process.stderr.write(`失败: ${e.message}\n`);
      process.stderr.write("[image-ocr] 语言包下载失败，请检查网络或 S3 配置\n");
      process.exit(2);
    }
  }
}

// ─── 主逻辑 ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  const imagePath = args.find((a) => !a.startsWith("--"));
  const jsonOut = args.includes("--json");
  const langArg = args.find((a) => a.startsWith("--lang="));
  const lang = langArg ? langArg.split("=")[1] : "chi_sim+eng";

  if (!imagePath) {
    process.stderr.write("用法: node ocr.js <image-path> [--lang chi_sim+eng] [--json]\n");
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    process.stderr.write(`文件不存在: ${imagePath}\n`);
    process.exit(1);
  }

  // 自动下载缺失的语言包
  const needed = LANG_TO_FILES[lang];
  if (!needed) {
    process.stderr.write(`不支持的语言: ${lang}. 可选: chi_sim, eng, chi_sim+eng\n`);
    process.exit(1);
  }
  await ensureModels(needed);

  const worker = await createWorker(lang, 1, {
    langPath: CACHE_DIR,
    cachePath: CACHE_DIR,
  });

  const {
    data: { text, confidence },
  } = await worker.recognize(imagePath);
  await worker.terminate();

  // 去除中文字符间多余空格
  const cleaned = text.replace(
    /(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g,
    ""
  );

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ text: cleaned.trim(), confidence }) + "\n");
  } else {
    process.stdout.write(cleaned.trim() + "\n");
  }
}

main().catch((e) => {
  process.stderr.write(e.message + "\n");
  process.exit(1);
});
