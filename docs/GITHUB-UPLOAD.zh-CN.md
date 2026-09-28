# 把 Visual art 上传到 GitHub

此目录已经初始化为本地 Git 仓库。下列操作从 **PowerShell** 执行；把 `你的用户名` 换成自己的 GitHub 用户名。GitHub 上的代码仓库和在线运行的网站是两回事；上传后，招生方可以看代码和说明，完整交互演示仍需单独部署。

## 1. 上传前检查

安装 Git、Node.js 24，注册并登录 GitHub。进入项目目录：

```powershell
cd 'C:\Users\17843\Desktop\学习\Visual-art-GitHub'
npm ci
npm run check:publish
npm run lint
npm run typecheck
npm test
npm run build
git status --short
```

检查 `.env.local` 和 `data/uploads/` 不出现在 `git status` 中。`.env.example` 只含空密钥。若你曾把密钥放在准备公开的文件、截图或旧仓库里，请先到服务商后台撤销并更换。公开提交后删除文件本身不能抹掉 Git 历史中的密钥。

## 2. 创建 GitHub 仓库

访问 [GitHub 创建仓库](https://github.com/new)，名称可用 `visual-art-stylist`。建议先选 **Private**，核对图片版权、个人资料和内容来源后再改为 Public。创建时不要勾选自动添加 README、`.gitignore` 或 License；本地已有对应内容或有意暂不授权复用。

## 3. 提交并上传

先设置 Git 提交身份（使用你自己的姓名和 GitHub 关联邮箱）：

```powershell
git config user.name '你的姓名'
git config user.email '你的邮箱'
git add .
git status --short
git diff --cached --stat
git commit -m 'Prepare Visual art portfolio project'
git remote add origin https://github.com/你的用户名/visual-art-stylist.git
git push -u origin main
```

如果 Git 提示 `origin` 已存在，先用 `git remote -v` 核对地址，再视情况用 `git remote set-url origin https://github.com/你的用户名/visual-art-stylist.git`。网页登录验证按 GitHub 的提示完成；不要把账户密码或令牌写进文件。若 GitHub 仓库初始化时已经创建了远程提交，先了解并合并远程历史，切勿直接 `--force` 覆盖。

## 4. 发布后检查及申请材料

打开仓库主页，确认英文 README、源代码、CI 的绿色检查和图片来源说明均可见；确认 `.env.local`、本机上传的照片、`node_modules`、`.next` 和日志均不存在。然后在 README、个人简历或作品集中使用实际仓库链接。申请材料可以参考 [PORTFOLIO.md](PORTFOLIO.md)，但必须按自己的真实贡献修改。

若需要可点击的在线演示，另选支持 Next.js 服务端路由的平台部署，先解决持久化上传与图片授权问题。本项目现有 `/api/*` 接口和本地文件上传，不能仅靠 GitHub Pages 运行完整功能。
