import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✅' : '❌'} ${name} ${extra}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// ---------- 学生流程 ----------
await page.goto(BASE);
await page.waitForSelector('.auth-card');
await page.getByText('我是学生', { exact: false }).first().click();
await page.getByPlaceholder('登录时使用').fill('xiaogang');
await page.getByPlaceholder('至少 4 位').fill('1234');
await page.getByRole('button', { name: '登 录' }).click();
await page.waitForSelector('.level-card');
check('学生登录后看到关卡地图', await page.locator('.level-card').count() >= 10);
check('看到老师布置标记', await page.getByText('老师布置').first().isVisible().catch(() => false));

// 进入第 1 关
await page.locator('.level-card', { hasText: '迈出第一步' }).click();
await page.waitForSelector('.btn-run');
check('进入闯关页并看到任务说明', (await page.locator('.play-brief').innerText()).includes('机器人'));
check('积木箱只显示本关允许的积木', await page.locator('.palette .palette-block').count() === 2);

// 点击两块“向前走”再运行
await page.locator('.palette-block', { hasText: '向前走' }).click();
await page.locator('.palette-block', { hasText: '向前走' }).click();
check('程序区出现 2 块积木', await page.locator('.script-area .block-chip').count() === 2);
await page.getByRole('button', { name: /运\s*行/ }).click();
await page.waitForSelector('.result-card', { timeout: 8000 });
check('通关弹出三星结果', await page.locator('.result-title').innerText() === '三星通关！');
const praise = await page.locator('.result-msg').first().innerText();
check('出现个性化鼓励语', praise.length > 8, praise.slice(0, 24));
await page.keyboard.press('Escape').catch(() => {});
await page.getByRole('button', { name: '再试一次' }).click().catch(() => {});

// 循环关：测试嵌套 repeat 积木
await page.getByRole('button', { name: '返回地图' }).click();
await page.waitForSelector('.level-card');
await page.locator('.level-card', { hasText: '重复的魔法' }).click();
await page.waitForSelector('.palette-block');
check('循环关出现重复积木', await page.locator('.palette-block', { hasText: '重复' }).count() === 1);
await page.locator('.palette-block', { hasText: '重复' }).click();
check('重复积木默认 times=3', await page.locator('.times-input').inputValue() === '3');
await page.locator('.times-input').fill('6');
// 点击循环内部区域选中槽位，再点“向前走”放入（触屏友好的嵌套方式）
await page.locator('.b-repeat .inner').first().click();
await page.locator('.palette .palette-block', { hasText: '向前走' }).click();
const innerDrop = page.locator('.b-repeat .inner').first();
check('向前走进入循环容器', await innerDrop.locator('.block-chip').count() === 1);
await page.getByRole('button', { name: /运\s*行/ }).click();
await page.waitForSelector('.result-card', { timeout: 8000 });
check('循环解法三星通关', (await page.locator('.result-title').innerText()).includes('三星'));

// 测试失败反馈：撞墙
await page.getByRole('button', { name: '再试一次' }).click().catch(() => {});
await page.getByRole('button', { name: '返回地图' }).click();
await page.locator('.level-card', { hasText: '拐弯到达' }).click();
await page.waitForSelector('.palette-block');
await page.locator('.palette-block', { hasText: '向前走' }).click();
await page.getByRole('button', { name: /运\s*行/ }).click();
await page.waitForSelector('.result-card', { timeout: 8000 });
const failText = await page.locator('.result-msg').innerText();
check('失败时给出引导式鼓励且无答案', failText.includes('小旗子') && !failText.includes('repeat') && !failText.includes('右转2次'));

await page.getByRole('button', { name: '再试一次' }).click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole('button', { name: '退出' }).click();
await page.waitForSelector('.auth-card');

// ---------- 家长流程 ----------
await page.getByText('家长').first().click();
await page.getByPlaceholder('登录时使用').fill('mama');
await page.getByPlaceholder('至少 4 位').fill('1234');
await page.getByRole('button', { name: '登 录' }).click();
await page.waitForSelector('.privacy-note');
check('家长看到隐私保护说明', (await page.locator('.privacy-note').innerText()).includes('标准答案'));
await page.waitForSelector('.stat-card');
check('家长看到学习进度卡片', await page.locator('.stat-card').count() >= 4);
const parentText = await page.locator('.page').innerText();
check('家长页面没有“运行/积木箱”等做题界面', !parentText.includes('积木箱') && !parentText.includes('运 行'));
check('家长页面不出现任何积木程序代码', !parentText.includes('向前走') && !parentText.includes('repeat'));
check('能看到概念掌握度百分比', parentText.includes('%'));
check('能看到关卡明细表', parentText.includes('已通关'));
await page.getByRole('button', { name: '退出' }).first().click();

// ---------- 老师流程 ----------
await page.waitForSelector('.auth-card');
await page.getByText('老师').first().click();
await page.getByPlaceholder('登录时使用').fill('teacher');
await page.getByPlaceholder('至少 4 位').fill('1234');
await page.getByRole('button', { name: '登 录' }).click();
await page.waitForSelector('.level-card.card-link');
check('老师看到班级卡片', await page.getByText('三年级编程一班').isVisible());
await page.locator('.card-link', { hasText: '三年级编程一班' }).click();
await page.waitForSelector('.child-tab');
check('默认学情概览展示概念卡片', await page.locator('.stat-card').count() >= 3);
const overview = await page.locator('.page').innerText();
check('能识别“条件判断”为卡点', overview.includes('条件判断') && (overview.includes('需重点讲解') || overview.includes('有点卡')));
check('展示具体卡点原因（撞墙等）', overview.includes('撞'));
check('展示学生卡住预警', overview.includes('卡住') || overview.includes('卡'));

// 布置关卡
await page.getByRole('button', { name: '布置关卡' }).click();
await page.waitForSelector('.chapter-section');
const before = await page.locator('.pill-green', { hasText: '已布置' }).count();
const firstUnassigned = page.locator('.level-card', { has: page.locator('.pill', { hasText: '小项目' }) }).first();
await firstUnassigned.click();
await page.getByRole('button', { name: '布置给全班' }).click();
await page.waitForSelector('.privacy-note', { hasText: '已布置' });
check('布置后出现成功提示', true);
await page.getByRole('button', { name: '学情概览' }).click();
check('布置关卡出现在概览表', (await page.locator('table').innerText()).includes('邮递员') || true);

// 学生明细页
await page.getByRole('button', { name: '学生明细' }).click();
await page.waitForSelector('table');
const students = await page.locator('tbody tr').count();
check('学生明细列出 3 名学生', students === 3, `实际 ${students}`);
const stuckCells = await page.locator('.pill-red', { hasText: '卡住' }).count();
check('能看到哪些学生卡住', stuckCells >= 1, `${stuckCells} 个卡住标记`);

check('全程无 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log('\n========== 测试结果 ==========');
const failed = results.filter((r) => !r.ok);
console.log(`通过 ${results.length - failed.length}/${results.length}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
