# git push 时预检分支

## 背景
多人协同开发场景下会存在开发分支未及时merge默认分支导致系统功能不正常。

## 解决方案
### 1.安装依赖
```javascript
pnpm add husky chalk isomorphic-fetch ora simple-git dotenv -D
```

### 2.执行husky
```javascript
pnpm exec husky init
```
注意：命令需要用bash窗口运行，window用户可以用git bash窗口运行该命令


### 3.Git 环境变量
```javascript
// .env.git
GIT_TOKEN = xxx
GIT_PROJECT_ID = xxx
```

### 4.检查脚本
```javascript
import chalk from 'chalk';
import dotenv from 'dotenv';
import fetch from 'isomorphic-fetch';
import ora from 'ora';
import simpleGit from 'simple-git';


dotenv.config({ path: '.env.git' });

const git = simpleGit();
const spinner = ora('Loading unicorns').start('开始检查仓库状态');

function exitProcess(code = 1) {
    console.log(''); // 换行美观一点
    process.exit(code);
}

async function checkMainHasMerge(defaultBranch) {

    spinner.start(`正在检查是否存在未合并的PR`);

    console.log(chalk.green(`正在检查${defaultBranch}分支`));

    const token = process.env.GIT_TOKEN;

    if (!token) {
        spinner.fail(chalk.red('未设置GIT_TOKEN,跳过检查'));
        exitProcess(0);
    }

    const repoId = process.env.GIT_REPO_ID;

    const apiUrl = `https://gitlab.com/api/v4/projects/${repoId}/merge_requests?state=opened&target_branch=${defaultBranch}`;

    const response = await fetch(apiUrl, {
        headers: {
            'PRIVATE-TOKEN': token
        }
    });

    const data = await response.json();


    if(!Array.isArray(data)){
        spinner.fail(chalk.red(`${defaultBranch}分支获取PR列表失败,检查RepoId是否正确,GIT_TOKEN是否过期`));
        exitProcess();
    }

    if (!data.length) return spinner.succeed(`${defaultBranch}分支没有未合并的PR`);

    spinner.fail(chalk.red(`${defaultBranch}分支有未合并的PR`));

    spinner.info(chalk.blue('┌─────────────────────────────Opened PR List──────────────────────────────────────────────┐'));
    // 打印未合并PR列表
    data.forEach(item => {
        spinner.info(chalk.blue(`${item.title}(${item.web_url})`));
    });
    spinner.info(chalk.blue('└───────────────────────────────────────────────────────────────────────────────────────┘'));
    exitProcess();
}


async function checkCurrentIncludeMain(defaultBranch) {

    const result = await git.raw(['rev-list', '--count', `origin/${defaultBranch}`, '^HEAD']);
    if (result > 0) {
        spinner.fail(chalk.red(`当前分支未包含最新${defaultBranch}`));
        exitProcess();
    }
    spinner.succeed(`当前分支包含最新${defaultBranch}`);
}

async function checkRepo() {
    // 获取远程默认分支
    const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const defaultBranch = result.trim().replace('refs/remotes/origin/', '');
    const branch = await git.branch();

    if (defaultBranch === branch.current) {
        spinner.succeed(`当前分支就是${defaultBranch},跳过检查`);
        exitProcess(0);
    }

    spinner.start(`正在检查${branch.current}分支是否包含最新${defaultBranch}`);

    await checkMainHasMerge(defaultBranch);
    await checkCurrentIncludeMain(defaultBranch);
}

checkRepo();
```

### 5.配置运行
```javascript
{
	"scripts":{
		"prepare": "husky", // husky init时会自动生成
    	"check-repo": "node scripts/check-repo.js"
}
```


### 6.执行脚本
配置 git hook，在.husky目录下创建 pre-push文件，内容为：
```javascript
pnpm run check-repo
```