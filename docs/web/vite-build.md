# 基于 Vite 优化前端镜像

## 背景
前端项目通常会将接口域名和变量写在不同的配置文件中，然后根据不同环境去取相应的变量，导致在发布时，需构建出不同环境的包，令构建特别耗时。而构建的多个产物只在配置参数层有所区别，业务代码是相同的，冗余消耗较多。

## 构建产物对比

### 优化前
```javascript
project
├─ .env
├─ .env.development
├─ .env.production
├─ .env.test
├─ dist
│  ├─ development // 开发环境包
│  ├─ production // 生产环境包
│  └─ test // 测试环境包
├─ index.html
├─ package.json
├─ public
│  ├─ favicon.ico
│  └─ user.gif
├─ README.md
├─ src
└─ vite.config.ts
```
### 优化后
```javascript
project
├─ .env
├─ .env.development
├─ .env.production
├─ .env.test
├─ deploy
│  ├─ nginx.conf
│  ── Dockerfile
│  └─ entrypoint.sh
├─ dist
│  ├─ assets
│   ── configs // [.env,.env.development,...]文件构建出来的产物
│  │    ├─ development.js
│  │    ├─ env.js
│  │    ├─ production.js
│  │    ├─ test.js
│   ── user.gif
│   ── favicon.ico
│  └─ index.html
├─ index.html
├─ package.json
├─ public
│  ├─ favicon.ico
│  └─ user.gif
├─ README.md
├─ src
└─ vite.config.ts
```

## 具体实现

### 1.安装dotenv依赖

```javascript
pnpm add dotenv -D
```

### 2.编写vite插件

```javascript
'use strict';


// 导入依赖模块
const dotenv = require('dotenv');
const fs = require('fs/promises');

// 包含所有配置的变量对象
const allEnvConfigs = {};

// 包含所有配置的环境变量名称
let allEnvKeys = [];

/**
 * 获取所有环境配置
 */
const getAllEnvConfigs = async () => {
  try {
    // 读取默认的环境变量配置文件
    const dataDefault = dotenv.parse(await fs.readFile(".env"));
    allEnvConfigs.default = dataDefault;


    // 获取所有以.env.开头的文件，并解析环境变量配置
    const list = (await fs.readdir("./")).filter((o) => o.match(".env.*"));
    for (let i = 0, j = list.length; i < j; i++) {
      const key = list[i].split(".").pop();
      allEnvConfigs[key] = dotenv.parse(await fs.readFile(list[i]));

    }

    // 将所有环境变量的键名存储到数组中
    for (let i in allEnvConfigs) {
      allEnvKeys.push(...Object.keys(allEnvConfigs[i]));
    }
    allEnvKeys = Array.from(new Set(allEnvKeys)); // 去重
  } catch (ex) {
    console.warn(ex);
  }
};

/**
 * 创建配置文件
 * @param {string} configDirPath 配置文件输出目录路径
 */
const createConfigs = async (configDirPath) => {
  try {
    // 如果输出目录存在，先删除再创建
    await fs.access(configDirPath);
    await fs.rm(configDirPath, { recursive: true, force: true });
  } catch (ex) {
    console.log(ex);
  }

  // 创建输出目录
  await fs.mkdir(configDirPath, {
    recursive: true,
    mode: 0o777,
    force: true,
  });

  // 获取默认环境配置
  const dataDefault = allEnvConfigs.default ?? {};
  for (let i in allEnvConfigs) {
    const dataEnv = allEnvConfigs[i];
    const data = { ...dataDefault, ...dataEnv }; // 合并当前环境变量与默认配置相同项，前者会覆盖后者
    const scripts = `globalThis._config = ${JSON.stringify(data)}`;

    // 根据环境创建对应的配置文件
    if (i === "default") {
      await fs.writeFile(`${configDirPath}env.js`, scripts);
    } else {
      await fs.writeFile(`${configDirPath}${i}.js`, scripts);
    }
  }
};

/**
 * Vite 插件函数
 * @param {object} options 插件选项
 */
function vitePluginEnvToBrowser(options = undefined) {
  // 设置默认的注入路径和输出目录路径
  let injectUrl = options?.injectUrl ?? "./configs/";
  if (!injectUrl.endsWith("/")) {
    injectUrl = injectUrl + "/";
  }
  let outputDir = options?.outputDir ?? "./dist/configs/";
  if (!outputDir.endsWith("/")) {
    outputDir = outputDir + "/";
  }

  return {
    // 插件名称和应用阶段
    name: "vite-plugin-env-to-browser",
    apply: "build",

    // 解析配置阶段，获取所有环境配置
    configResolved(resolvedConfig) {
      getAllEnvConfigs();
    },

    // 构建开始阶段
    buildStart(options) { },

    // 构建结束阶段，创建配置文件
    buildEnd() {
      createConfigs(outputDir);
    },

    // 代码转换阶段，将代码中的环境变量替换为全局变量
    async transform(code, id) {
      let codeResult = code;
      allEnvKeys.forEach((key) => {
        codeResult = codeResult.replace(
          new RegExp(`import.meta.env.${key}`, "g"),
          `globalThis._config.${key}`
        );
      });
      return {
        code: codeResult,
        map: null,
      };
    },

    // HTML 转换阶段，在生产环境下向 HTML 中添加配置文件的引用
    transformIndexHtml(html) {
      // 防止更新env文件缓存问题
	  const timestamp = Date.now().toString()
      return {
        html,
        tags: [
          {
            injectTo: "head-prepend",
            tag: "script",
            attrs: {
              src: `${injectUrl}env.js?v=${timestamp}`,
            },
          },
        ],
      };
    },
  };
}

// 导出插件函数
module.exports = vitePluginEnvToBrowser;
//# sourceMappingURL=index.js.map
```

### 3.配置vite.config.ts

```javascript
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vitePluginEnvToBrowser from "./vite-plugin-to-browser" // 上面编写的插件

export default defineConfig({
  plugins: [
	   // 这里使用
	   vitePluginEnvToBrowser({
        injectUrl: "./", // 配置文件引入地址  主要体现在:/dist/index.html中  引入环境变量的script地址 inject+'env.js'
        outputDir: "./dist/configs/", // 文件写入的地址
      }),
	  vue()
	],

})
```
### 5.entrypoint.sh
```bash
#!/bin/bash
cp -rf /usr/share/nginx/html/configs/$ENV_NAME.js /usr/share/nginx/html/env.js
nginx -g "daemon off;"
```

### 6.配置Dockerfile

```dockerfile
# -------------------------主要看这块配置------------------------------------
# 1、复制entrypoint脚本到根目录，特别注意一下脚本在项目中的位置。
COPY /deploy/entrypoint.sh /
# 2、执行entrypoint脚本
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["sh", "/entrypoint.sh"]
# --------------------------------------------------------------------------

EXPOSE 80
```
