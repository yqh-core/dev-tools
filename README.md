# DigDevBox - 开发者常用在线工具

面向开发者与运维人员的在线工具集合，纯前端运行，所有计算都在浏览器本地完成，不上传任何数据。

- 线上地址：<https://digdevbox.com>
- 源码仓库：<https://github.com/yqh-core/dev-tools>
- 上游项目：[it-tools](https://github.com/CorentinTh/it-tools)（GPL-3.0），本项目在其基础上做了品牌与维护性改造

## 本次改造要点

- 品牌统一为 **DigDevBox**，站点标题、侧栏 Logo、命令面板、关于页、社交链接全部替换
- 移除原作者的赞助入口与外部社交账号链接，统一指向本项目仓库
- 关于页如实标注上游来源与许可证，保留署名
- 26 个 e2e 用例里的页面标题断言同步更新

---

## 运行步骤


### 准备node环境

https://nodejs.org/zh-cn/download


### 安装pnpm

```sh
npm install pnpm -g
```

### 安装依赖

```sh
pnpm install
```

### 开发环境运行

```sh
pnpm dev
```

### 生产环境构建

```sh
pnpm build
```



### nginx部署


```
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 注意

浏览器调试的时候，可以关闭sw.js的注册

application--> service workers


## 视频教程

https://www.youtube.com/watch?v=L_sii6bwnEs