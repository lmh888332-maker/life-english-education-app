# Life English 腾讯云更新说明

本包用于更新当前运行在 `111.231.20.205:5002` 的 Life English。

## 本次修复

- 账号与全部学习数据改为服务端 SQLite 持久化；退出、刷新、关闭浏览器或重新登录后仍可恢复。
- 同一“昵称 / 登录名 + 密码”自动判断登录或注册，不再只是浏览器里的演示账号。
- 旧版本浏览器中已有的本地档案，会在首次登录后自动迁移到服务器。
- 词库复习卡显示完整参考表达、含义、用法、使用提示和来源场景。
- 短剧跟读会检查 HTTPS 与麦克风权限，再启动语音识别和逐词反馈。

## 一、先建立独立数据库目录

登录腾讯云服务器后执行：

```bash
mkdir -p /www/wwwroot/life-english-data
```

数据库会自动创建为：

```text
/www/wwwroot/life-english-data/life-english.sqlite
```

这个目录在项目源码之外。以后替换或删除旧源码时，不要删除 `life-english-data`。

## 二、上传并替换源码

以下示例假设旧项目放在 `/www/wwwroot/life-english`。如果实际目录不同，请替换命令中的路径。

把新压缩包上传到服务器后执行：

```bash
cd /www/wwwroot
unzip Life-English-Tencent-v17-persistent.zip
cd Life-English-Tencent-v17-persistent
npm ci
```

如果旧项目已配置千问，复制旧 `.env.local`：

```bash
cp /www/wwwroot/life-english/.env.local /www/wwwroot/Life-English-Tencent-v17-persistent/.env.local
```

如果没有 `.env.local`，执行：

```bash
cp .env.example .env.local
nano .env.local
```

确认 `.env.local` 包含以下四项：

```env
DASHSCOPE_API_KEY=在这里填写你的千问服务端API密钥
QWEN_MODEL=qwen-plus-latest
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LIFE_ENGLISH_DB_PATH=/www/wwwroot/life-english-data/life-english.sqlite
```

如果复制的是旧 `.env.local`，也必须补上最后一行 `LIFE_ENGLISH_DB_PATH`。不要把 API 密钥发到聊天、提交到 GitHub 或写进前端代码。

## 三、构建并重启

先确认 Node.js 版本不低于 22.13：

```bash
node -v
```

构建：

```bash
cd /www/wwwroot/Life-English-Tencent-v17-persistent
npm run build
```

查看 PM2 进程名：

```bash
pm2 list
```

如果进程名是 `life-english`：

```bash
pm2 delete life-english
cd /www/wwwroot/Life-English-Tencent-v17-persistent
PORT=5002 HOSTNAME=0.0.0.0 pm2 start npm --name life-english -- run start
pm2 save
```

以后更新同一目录时执行：

```bash
cd /www/wwwroot/Life-English-Tencent-v17-persistent
npm ci
npm run build
pm2 restart life-english --update-env
```

如果使用宝塔 Node 项目管理器，把项目目录改为 `/www/wwwroot/Life-English-Tencent-v17-persistent`，启动命令保持 `npm run start`，端口保持 `5002`，然后重启。

## 四、检查数据库与千问

检查账号接口：

```bash
curl -i http://127.0.0.1:5002/api/account
```

未登录时返回 HTTP `401` 和“登录状态已失效”属于正常，说明账号接口已运行。

注册并完成一次打卡后，确认数据库已生成：

```bash
ls -lh /www/wwwroot/life-english-data/
```

检查千问：

```bash
curl http://127.0.0.1:5002/api/qwen
```

正常应看到类似：

```json
{"configured":true,"model":"qwen-plus-latest"}
```

如果 `configured` 是 `false`，确认 `.env.local` 位于新项目根目录，再执行：

```bash
pm2 restart life-english --update-env
```

## 五、验证退出后数据仍在

1. 使用新登录名和至少 8 位密码进入网站。
2. 完成一次打卡或收藏一个表达。
3. 进入“我的 → 账号与退出”，点击“确认退出账号”。
4. 点击“重新进入 Life English”，确认 XP、打卡和词库仍在。
5. 刷新页面，再换一个浏览器使用相同登录名和密码，确认能恢复同一份档案。

“删除账号与全部学习档案”会真正删除服务器中的该账号，不是普通退出，请不要把它当作退出按钮。

## 六、跟读功能必须使用 HTTPS

当前地址 `http://111.231.20.205:5002/` 是普通 HTTP。Chrome 等浏览器会阻止该页面访问麦克风，因此跟读必须通过 HTTPS 域名使用。

需要：

1. 将域名解析到 `111.231.20.205`。
2. 在腾讯云安全组放行 80 和 443 端口。
3. 使用 Nginx 反向代理到 `127.0.0.1:5002`。
4. 为域名安装 SSL 证书，并使用 `https://你的域名` 访问。

Nginx 反向代理示例：

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

SSL 配置完成后，用最新版 Chrome 打开 HTTPS 地址，首次点击跟读时选择“允许麦克风”。

## 七、更新后检查

- 退出账号、刷新页面并重新登录，确认 XP、打卡、词库、场景和短剧进度仍在。
- 换一个浏览器使用相同登录名与密码，确认能恢复同一档案。
- 打开“词库”并进入复习，确认卡片包含完整参考答案。
- 打开“短剧”，使用 HTTPS 点击跟读，确认出现麦克风授权与逐词反馈。
- 打开“实验室”，发送一句英语，确认千问返回上下文回复。
