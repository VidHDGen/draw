# 画画接龙

3–12 人在线接龙游戏：写句子 → 画画 → 猜画，最后一起揭晓。手机和电脑均可玩，无需注册。

代码保存在 GitHub，网站与游戏接口部署到你自己的 Cloudflare Workers。D1 保存房间，R2 保存画作；运行时不需要 OpenAI 服务或 API Key。GitHub Pages 只支持静态网站，不能单独运行本项目的多人房间后端。

## 本地运行

安装 Node.js 24，然后在项目目录执行：

```sh
npm ci
npm run db:local
npm run dev
```

生产构建预览：

```sh
npm run build
npm start -- --port 8787
```

打开 http://127.0.0.1:8787 。本地使用模拟 D1 / R2，数据位于 `.wrangler/state`，无需登录 Cloudflare。

## 首次部署到自己的 Cloudflare

本仓库已经为 VidHDGen 的账户创建了 `draw-relay-db` 和 `draw-relay-images`，配置中已填入实际数据库 ID 和游戏域名。该账户后续更新只需登录后运行 `npm run deploy`，无需重复创建资源。以下步骤供迁移到另一个账户时参考；请同时将 `routes` 改为你自己的域名，或先移除它。

1. 执行官方登录命令，在浏览器完成授权：

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

2. 创建数据库与私有图片桶（账户需已启用 R2；是否启用及费用以 Cloudflare 页面为准）：

   ```sh
   npx wrangler d1 create draw-relay-db
   npx wrangler r2 bucket create draw-relay-images
   ```

3. 将创建数据库时返回的 `database_id` 填入 `wrangler.jsonc`。桶名称应与 `r2_buckets[0].bucket_name` 一致。不要开启桶的公开访问，游戏接口会验证玩家身份。

4. 发布：

   ```sh
   npm run deploy
   ```

   此命令先构建，再应用生产数据库迁移，最后上传 Worker 和静态资源。打开输出的 `workers.dev` 地址，验证创建房间和多人对局。

5. `wrangler.jsonc` 的 `routes` 已配置 Custom Domain：`draw.vidhdgen.dpdns.org`，发布时会自动绑定。旧的 `draw` CNAME 若还指向其他平台，需要先移除这条冲突记录，再重新发布。Cloudflare 会为新绑定管理 DNS 和 HTTPS。不要修改根域名隧道、MX、SPF 或 DKIM 记录。

域名迁移只影响访问入口，旧平台的房间与画作不会自动迁移；请在新站重新创建房间。迁移后实际可访问性仍需使用朋友的网络验证。

## 从 GitHub Actions 发布

仓库已包含手动发布流程，不会在每次推送时自动上线。在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 授权目标账户部署 Workers、写入 D1、访问部署所需 R2 信息，以及目标域名的 Zone Read / Workers Routes 权限的 Cloudflare API Token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| Variable | `CLOUDFLARE_D1_DATABASE_ID` | 已创建的 D1 数据库 UUID |
| Variable，可选 | `CLOUDFLARE_R2_BUCKET_NAME` | 默认 `draw-relay-images` |

密钥仅在 Cloudflare 和 GitHub 的官方界面填写，不要提交进代码或聊天。进入 Actions → Deploy drawing relay → Run workflow 发布。GitHub Actions 需要自行配置这些密钥；本机的 Wrangler 登录不会自动同步到 GitHub。

## 验证

```sh
npm run typecheck
npm test
```

本地生产预览启动后，另一个终端运行：

```sh
node tests/e2e.mjs
```

端到端测试会创建独立测试房间，覆盖三人并发加入、三轮接龙、画作存取、隐藏答案、身份校验、过期提交、重新开局与房主交接。可通过 `TEST_BASE_URL` 环境变量指定另一个测试地址。

`node tests/timeout-e2e.mjs` 默认连接本地开发服务 `http://localhost:5173`，也支持 `TEST_BASE_URL`。测试使用真实的 60 秒回合，验证只保存草稿而不提交的玩家在超时后仍能传出画作、结束时的上传缓冲，以及笔画回放完整性，运行约 75 秒。

## 游戏说明与维护

- 分享六位房间码或邀请链接；至少三人，所有非房主玩家准备后由房主开始。支持 60 / 90 / 120 / 180 秒回合。
- 鼠标、触屏画板：颜色、粗细、橡皮、撤销、重做和清空。草稿保存在当前浏览器。
- 每位玩家使用自己的设备或浏览器。同一浏览器的标签页共享身份。刷新后可恢复身份。
- 每两秒同步状态；所有人提交或回合超时后进入下一轮。进行中仅能看到上一棒，结束后开放完整接龙。
- 绘画有变化时每四秒自动备份图片和笔画；倒计时归零时锁定画布并提交最终画面（包括尚未抬笔的一笔），失败会重试。服务器预留最多十秒接收最终上传，随后使用最近成功保存的草稿兜底，不再直接跳过。完全离线且从未上传的内容无法送达服务器。旧草稿不能覆盖已交卷作品，替换的临时图片会清理。
- 房间在 24 小时后不可访问。这不等于图片立即物理删除；可在 R2 为本游戏桶配置两天后的对象过期规则，定期清理数据库过期记录。
- 代码使用 React / Vinext / Cloudflare Workers。生产配置位于 `wrangler.jsonc`，数据库迁移位于 `drizzle/`。

参考：[Cloudflare 自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)、[R2 对象生命周期](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)。

## 新版选词与动画回放

- 桌面画布为 960×600，手机竖屏新画作使用 600×800 的更高画布，支持放大模式；保存、猜画和回放保持画作原比例。
- 32 种预设颜色和自定义调色器。
- 每位玩家开场三选一；每局最多换三组，次数由服务端保存，刷新不会重置。
- 词库见 `lib/words.ts`：保留用户指定词，扩充搞怪人物与动作组合、成语、夸张情绪和网络梗。每组三个选项混合不同类别，同局所有玩家的候选词不重复。房间保存最近 1600 个候选词，下一局优先抽取未出现的词；某类词用尽后从最久未出现的词开始轮换。历史保留在服务端，重新建房会重新随机。
- 游戏结束后预留 5 秒准备时间，全房间自动进入同步回放。每一棒先在中央展示玩家头像和姓名，再移到画布左上角，然后逐笔播放画作或揭晓猜词。
- 服务器保存回放开始时间并生成统一时间表，刷新或重连会接上当前进度；不提供个人暂停、跳过或调速，全部接龙播放结束后，每个人可以独立返回房间并准备；所有人返回且非房主玩家全部准备后，房主才能开启下一局。
- 猜词音效由浏览器合成，可单独静音；浏览器未解锁音频时，点“开启音效”即可。音效状态不影响全房间回放进度。
- 笔画、橡皮、撤销、重做与清空操作记录保存在私有 R2 中，只在结算后允许本房间玩家读取。回放按绘制顺序加速展示，不保留作画时的停顿。
- 更新前已保存的画作只有图片，无法补录笔画，会自动显示最终画作。要体验完整新版，请所有人刷新后开始新的一局。


## 房间管理与准备

- 房主在“管理玩家”中可移出其他玩家。被移出者的当前身份无法再次进入同一房间；这不是基于账号或 IP 的封禁。
- 进行中移出玩家会保留座位和已提交作品，后续空白回合自动跳过，避免打乱接龙及同步回放。
- 每人独立返回房间，不打断其他人的结算页面。可以准备或取消准备，刷新保留状态，开局后清空准备状态。
- 普通模式和放大画布都在左上方展示上一位玩家的头像、昵称和这轮收到的词语；后续绘画轮显示上一位的猜词，仍不泄露更早的接龙答案。
