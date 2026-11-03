# Life English｜AI人生英语

Life English是一款以真实生活任务为主线的英语学习网页APP。学习者可以从A1—A2、B1—B2或C1路线开始，在酒店、机场、合租、面试与职场协商等情境中完成表达任务，并通过AI对话、互动短剧、词库复习和成长记录形成学习闭环。

## 在线体验

- 网站：https://life-english.anemone-phoneme63.chatgpt.site/
- 作者：刘梦涵
- 学号：0241128004

## 核心模块

- 分层情境地图与路线解锁
- 选择题对话与即时反馈
- AI自由对话实验室
- 互动短剧、原声与跟读练习
- 真实表达词库与AI复习
- XP、打卡、勋章与成长记录

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4
- 服务端 API 路由：`app/api/qwen`（通义千问对话）、`app/api/account`（账号与学习档案）
- SQLite 学习档案持久化，密码使用随机盐 + scrypt 哈希保存
- 环境要求：Node.js 22.13 或更高版本

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

然后按照终端显示的地址在浏览器中打开。

## 配置千问 API

在 `.env.local` 中填写（真实密钥请勿提交到 GitHub，项目统一在服务端调用千问）：

```env
DASHSCOPE_API_KEY=你的千问服务端API密钥
QWEN_MODEL=qwen-plus-latest
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 项目结构

```text
app/page.tsx             主界面、学习逻辑与交互
app/globals.css          全站视觉样式与响应式布局
app/api/qwen/route.ts    千问服务端接口
app/api/account/route.ts 账号登录与学习档案接口
public/assets/           场景和短剧插画资源
tests/                   渲染测试
docs/                    项目文档
diagrams/                功能结构、用户流程、页面跳转和技术框架图
screenshots/             部署版页面截图
```

## 项目文档

- `docs/项目概览.md`：目标用户、学习问题与设计思路
- `docs/核心功能.md`：主要功能和实现逻辑
- `docs/测试摘要.md`：任务走查方法与迭代结论
- `docs/部署说明.md`：在线部署与运行环境
- `docs/学习目标与评价对应.md`：学习目标、功能和观察证据
- `docs/已实现功能与后续优化.md`：当前完成度和开发边界
- `docs/可访问性与隐私说明.md`：字幕、反馈、数据与AI使用边界
- `docs/答辩演示流程.md`：现场展示顺序与表达重点
- `TENCENT-CLOUD-UPDATE.md`：腾讯云部署与版本迭代记录

## 数据说明

账号与学习档案会按登录名保存在服务端 SQLite 数据库中，浏览器 `localStorage` 仅作为本地缓存。数据库位置由 `LIFE_ENGLISH_DB_PATH` 指定，本地默认 `./data/life-english.sqlite`；腾讯云部署时应配置到项目目录外的持久路径，避免替换源码时误删数据库。
