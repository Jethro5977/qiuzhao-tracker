# 秋招投递台账

一个面向 2027 届秋招和实习申请的个人进度追踪器，用来集中管理岗位、笔试面试、下一步日程，并在保存前提示可能的重复投递。

## 在线使用

- Cloudflare 主站：[https://qiuzhao-tracker-41x.pages.dev/](https://qiuzhao-tracker-41x.pages.dev/)
- GitHub Pages 备用站：[https://jethro5977.github.io/qiuzhao-tracker/](https://jethro5977.github.io/qiuzhao-tracker/)

![秋招投递台账界面](./public/readme-dashboard.png)

## 主要功能

- 表格、进度看板和日程三种视图
- 按状态、公司、岗位、地点筛选和排序
- 根据公司、岗位族、批次、地点和岗位链接提示重复投递
- 管理未来笔试、面试和投递截止日程
- 浏览器本地自动保存与未提交草稿恢复
- 从两份腾讯岗位来源表分别建立索引，输入序号填充完整岗位信息
- 截图 OCR：识别投递、笔试或面试页面，核对后录入进度
- JSON 完整备份和恢复，CSV 导出查看

## 岗位来源表

目前支持两份独立来源，序号只在所选来源表内查询，因此两张表出现相同序号时不会串岗：

1. [2027届校招信息汇总表](https://docs.qq.com/sheet/DQUNxdHRXcndkeHFK?tab=986nx3)
2. [【阿发】2027届实习+校招汇总表](https://docs.qq.com/sheet/DQWVVWm1vcUJzU3Vy?tab=WLaNT6)

腾讯文档的访客复制或导出权限由表格所有者控制。网站不会绕过访问权限，也不会自动抓取受限内容；请使用自己有权获取的 CSV、TSV 或复制后的表格数据建立本机索引。

## 使用说明

### 按序号录入岗位

1. 在首页“按来源表序号录入”中选择岗位所在的来源表。
2. 点击“打开当前来源表”，获取有权限使用的表格数据。
3. 点击“导入当前来源表”，上传 CSV / TSV / TXT，或粘贴包含表头的内容。
4. 源表至少需要包含“序号、公司名称、招聘岗位”三列。
5. 输入序号并点击“获取岗位信息”，核对自动填写的字段与重复提示后保存。

旧版本中导入的第一份来源表索引会自动迁移；第二份来源表需要单独导入一次。更新任一来源索引不会改变已经保存的个人投递记录。

### 通过截图更新进度

1. 点击“上传截图”，选择包含岗位卡片、公司名称和投递进度的 PNG、JPG、WEBP 或 GIF。
2. 等待浏览器本地完成文字识别。
3. 逐条核对公司、岗位、状态和投递时间，再点击“核对并录入”。
4. 在岗位编辑窗口确认字段和重复提示后保存。

识别模型首次使用时会下载中文语言数据。截图识别在当前浏览器内执行；识别结果不会在未经确认的情况下直接写入台账。

### 自动保存与备份

编辑内容会实时保存为本机草稿，关闭或刷新页面后可以继续编辑。点击“保存记录”并通过校验后，岗位才会进入台账。

岗位记录、来源索引和草稿默认保存在当前浏览器。换设备、清理浏览器数据或更换域名之前，请先使用“导出与备份”下载 JSON 完整备份。CSV 适合表格查看，但不代替完整备份。

## 本地运行

需要 Node.js 22 或更高版本：

```bash
npm install
npm run dev
```

质量检查：

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## 部署

### Cloudflare Pages

项目构建后可发布到现有 `qiuzhao-tracker` Pages 项目：

```bash
npm run build
npx wrangler pages deploy dist/client --project-name qiuzhao-tracker --branch main
```

### GitHub Pages

推送到 `main` 分支后，GitHub Actions 会执行测试、类型检查和构建，并自动更新 GitHub Pages 备用站点。
