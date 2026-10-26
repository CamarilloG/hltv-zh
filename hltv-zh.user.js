// ==UserScript==
// @name         HLTV 中文汉化 + 去广告 - HLTV.org 简体中文翻译（菜单 + 新闻论坛机翻）
// @name:en      HLTV Chinese + AdBlock - Simplified Chinese translation for HLTV.org
// @namespace    https://github.com/CamarilloG/hltv-zh
// @version      0.3.2
// @description  HLTV.org 中文版：菜单、标签、按钮、地区国家、日期时间全部汉化，新闻标题、正文、论坛帖子用必应翻译自动机翻；战队、选手、赛事名与 CS2 术语（Major、IGL、VRS、Rating）保留英文；顺带清除博彩广告、赔率、赞助横幅与导航「博彩」菜单。机翻与去广告都可在油猴菜单一键开关
// @description:en Translate HLTV.org into Simplified Chinese: menus, tabs, countries, dates, plus Bing machine translation for news and forum posts. Team, player and event names and CS2 terms stay in English. Also removes betting ads, odds and sponsor banners.
// @author       CamarilloG
// @license      MIT
// @homepageURL  https://github.com/CamarilloG/hltv-zh
// @supportURL   https://github.com/CamarilloG/hltv-zh/issues
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hltv.org
// @match        https://www.hltv.org/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      www.bing.com
// ==/UserScript==

// —— 去广告：博彩广告框、整页背景广告、赔率、赞助横幅与赞助外链、导航「博彩」菜单（页脚不动） ——
// 在 document-start 运行：body 一出现就清掉整页背景广告，赶在首次绘制和 HLTV 绑定背景点击跳转之前，
// 否则切换、刷新页面时广告会闪一下，点两侧还会弹出空白页。
(function () {
  'use strict';

  const AD_ON = typeof GM_getValue === 'function' ? GM_getValue('adblock', true) : true;
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(`去广告：${AD_ON ? '已开启（点击关闭）' : '已关闭（点击开启）'}`, () => {
      if (typeof GM_setValue === 'function') GM_setValue('adblock', !AD_ON);
      location.reload();
    });
  }
  if (!AD_ON) return;

  // 图片广告都是 <a rel="nofollow" href="/out2/…"><img></a>，外层 div 类名是随机串，所以按链接特征识别；
  // 直播源、论坛外链直接指向目标站，不经过 /out2，不受影响。
  // :has() 不能嵌套，规则要分开写：一条选择器不合法时浏览器会丢掉整条规则。
  const AD_LINK = 'a[rel~="nofollow"][href*="/out2/"]';
  const AD_CSS = [
    '.bg-sidebar', '.mobiletop.centered-placement',
    '.yabo-firstcol-box', '.world-ranking-banner', '.presented-by-row',
    '#betting', '.betting-section', '.match-fixtures',
    `${AD_LINK}:has(> img):not(footer *)`,
    '.navcon .nav-item:has(> a.nav-link[href*="/betting"])',
  ];
  const style = document.createElement('style');
  style.textContent = AD_CSS.map((sel) => `${sel} { display: none !important; }`).join('\n')
    + '\nbody { background-image: none !important; cursor: auto !important; }';

  // 整页背景广告写在 body 的 style 属性里且带 !important（样式表压不过），并用 data-href 把 body 变成跳转链接。
  const BG_PROPS = ['background', 'background-image', 'background-color', 'background-repeat', 'background-position', 'background-attachment', 'background-size'];
  let hadBgAd = false;
  const cleanBody = () => {
    const b = document.body;
    if (b.hasAttribute('data-href')) { b.removeAttribute('data-href'); hadBgAd = true; }
    if (BG_PROPS.some((p) => b.style.getPropertyValue(p))) BG_PROPS.forEach((p) => b.style.removeProperty(p));
  };
  // HLTV 的 installAds 在加载时看 body 有没有 data-href，有就绑 mousedown/mouseup，松开时 window.open(body.dataset.href)。
  // 正常情况下我们抢在它之前删掉 data-href；万一晚了，在捕获阶段拦下直接点在 body 空白处的鼠标事件。
  ['mousedown', 'mouseup', 'click'].forEach((type) => window.addEventListener(type, (e) => {
    if (hadBgAd && e.target === document.body) e.stopImmediatePropagation();
  }, true));

  // 图片广告外层套着一个类名随机的 div，只装着广告链接；链接藏掉后把这层空壳也藏掉，免得留白。
  const hideShell = (img) => {
    const shell = img.parentElement && img.parentElement.parentElement;
    if (shell && shell.tagName === 'DIV' && !shell.closest('footer')
      && [...shell.children].every((c) => c.matches(AD_LINK))) shell.style.setProperty('display', 'none', 'important');
  };
  const hideAdShells = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(`${AD_LINK} > img`)) hideShell(node);
    node.querySelectorAll(`${AD_LINK} > img`).forEach(hideShell);
  };

  // document-start 时 <html>、<body> 可能都还没建出来，等它们出现再动手。
  let styled = false;
  const onBody = () => {
    cleanBody();
    new MutationObserver(cleanBody).observe(document.body, { attributes: true, attributeFilter: ['data-href', 'style'] });
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(hideAdShells)))
      .observe(document.body, { childList: true, subtree: true });
    hideAdShells(document.body);
  };
  const tryStart = () => {
    if (!styled && document.documentElement) {
      document.documentElement.appendChild(style);
      styled = true;
    }
    if (!document.body) return false;
    onBody();
    return true;
  };
  if (!tryStart()) {
    const mo = new MutationObserver(() => { if (tryStart()) mo.disconnect(); });
    mo.observe(document, { childList: true, subtree: true });
  }
})();

// —— 翻译：页面解析完再跑 ——
function hltvZhMain() {
  'use strict';

  // 精确匹配词表：键为去掉首尾空白后的原文（区分大小写的版本会先查，查不到再按小写查）。
  // 术语保留英文：HLTV、Major、MVP/EVP、Top20、VRS、FPL、LAN、CS2/CSGO、Rating、FACEIT、Fantasy、地图名、Best of X。
  const DICT = {
    // —— 顶部主导航 ——
    'News': '新闻',
    'Matches': '比赛',
    'Results': '结果',
    'Ranking': '排名',
    'Events': '赛事',
    'All events': '全部赛事',
    'Ongoing': '进行中',
    'Archive': '历史赛事',
    'Calendar': '赛历',
    'VRS Invites': 'VRS 邀请',
    'Live': '直播中',
    'Players': '选手',
    'Retired Players': '退役选手',
    'Transfers': '转会',
    'Prospects': '新星',
    'Player explorer': '选手检索',
    'Hall of Fame': '名人堂',
    'Stats': '数据',
    'Stats overview': '数据总览',
    'Top players': '顶级选手',
    'Top teams': '顶级战队',
    'Maps': '地图',
    'Fantasy Overview': 'Fantasy 总览',
    'Forum': '论坛',
    'Betting': '博彩',
    'Hardware & Tweaks': '硬件与调校',
    'Bugs & Suggestions': '问题与建议',
    'Media': '媒体',
    'HLTV Confirmed': 'HLTV 认证',
    'Galleries': '图集',
    'Timeline Game': '时间线小游戏',
    'Betting US': '博彩（美国）',
    'Betting Canada': '博彩（加拿大）',
    'Betting UK': '博彩（英国）',
    'Betting India': '博彩（印度）',
    'Betting Brazil': '博彩（巴西）',
    'Betting Sweden': '博彩（瑞典）',
    'Betting Denmark': '博彩（丹麦）',
    'Betting Other Locations': '博彩（其他地区）',
    'Compare odds': '赔率对比',
    'Analytics': '分析',
    'Skins': '皮肤',
    'Search': '搜索',
    'Search...': '搜索…',

    // —— 登录 / 设置弹窗 / 比赛筛选 ——
    'Remember me': '记住我',
    'Forgot password': '忘记密码',
    'Login': '登录',
    'Sign up': '注册',
    'Recover': '找回',
    'Back': '返回',
    'Sign in': '登录',
    'Settings': '设置',
    'Theme': '主题',
    'Day': '日',
    'Night': '夜间',
    'Auto': '自动',
    'Show results': '显示比分',
    'Yes': '是',
    'No': '否',
    'Automatic Timezone': '自动时区',
    'On': '开',
    'Off': '关',
    'Timezone': '时区',
    'Force desktop mode': '强制桌面版',
    'Match filter settings': '比赛筛选设置',
    'Expand': '展开',
    'Enable filter': '启用筛选',
    'Reset filter': '重置筛选',
    'Match type': '比赛类型',
    'Live match': '直播比赛',
    'Star filter': '星级筛选',
    'Clear': '清除',
    'Min. stars': '最低星级',
    'Event type': '赛事类型',
    'Team': '战队',
    'Teams': '战队',

    // —— 侧边栏标题 ——
    'AWARD BY': '奖项提供',
    'Player of the week': '本周最佳选手',
    'Most damage / round': '场均伤害最高',
    'RANKING BY': '排名提供',
    'Complete ranking': '完整排名',
    'Last updated:': '最近更新：',
    'EVENTS': '赛事',
    'Event calendar': '赛历',
    'FPL RANKING': 'FPL 排名',
    'GALLERIES': '图集',
    "TODAY'S MATCHES": '今日比赛',
    'RESULTS': '比赛结果',
    'RECENT ACTIVITY': '最新动态',
    'Forum preferences': '论坛偏好',
    'Enable Sport mode': '启用体育模式',
    'Enable Off Topic': '显示灌水区',
    'MINIGAME': '小游戏',
    'Timeline': '时间线',
    'Play': '开始',
    'TOP 30 TRANSFERS': '前 30 转会',
    'BENCH': '替补',
    'No team': '无战队',
    'COACH': '教练',
    'All transfers': '全部转会',
    'Now playing': '正在直播',
    'Top streams': '热门直播',
    'All': '全部',
    'Casters': '解说',
    'Streamers': '主播',
    'Organizers': '主办方',
    "Today's news": '今日新闻',
    "Yesterday's news": '昨日新闻',
    'Previous news': '更早新闻',
    'Ranking by': '排名提供',

    // —— 比赛 / 结果页 ——
    'Live Counter-Strike matches': '正在进行的 CS 比赛',
    'Upcoming Counter-Strike matches': '即将进行的 CS 比赛',
    'Featured results': '精选结果',
    'Filters': '筛选',
    'Stars': '星级',
    'Time': '时间',
    'All time': '全部时间',
    'Last month': '近 1 个月',
    'Last 3 months': '近 3 个月',
    'Last 6 months': '近 6 个月',
    'Last 12 months': '近 12 个月',
    'Majors': 'Major',
    'Big events': '大型赛事',
    'MVP events': '有 MVP 的赛事',
    'Online': '线上',
    'All matches': '全部比赛',
    'Grand final': '总决赛',
    'Playoffs': '季后赛',
    'Pre-playoff': '季后赛前',
    'Map': '地图',
    'Season': '赛季',
    'Event': '赛事',
    'Player': '选手',
    'Game': '游戏版本',
    'Valve ranked': 'Valve 积分赛',
    'Both': '全部',
    'Ranked': '计积分',
    'Unranked': '不计积分',

    // —— 赛事页 ——
    'Ongoing events': '进行中的赛事',
    'Played events': '已结束的赛事',
    'Upcoming events': '即将开始的赛事',
    'Ongoing & upcoming': '进行中及即将开始',
    'Finished': '已结束',
    'International LAN': '国际 LAN',
    'Regional LAN': '地区 LAN',
    'Local LAN': '本地 LAN',
    'Other': '其他',
    'Prize pool': '奖金池',
    'Remove': '移除',
    'Attending teams': '参赛战队',
    'Attending player': '参赛选手',

    // —— 排名页 ——
    'World': '世界',
    'Invites': '邀请',
    'Ranking details': '排名详情',
    'Regional': '地区',
    'HLTV Team profile': 'HLTV 战队资料',
    'January': '1 月', 'February': '2 月', 'March': '3 月', 'April': '4 月', 'May': '5 月', 'June': '6 月',
    'July': '7 月', 'August': '8 月', 'September': '9 月', 'October': '10 月', 'November': '11 月', 'December': '12 月',
    'Year': '年',
    'Month': '月',

    // —— 战队 / 选手页 ——
    'Info': '资料',
    'Roster': '阵容',
    'Achievements': '成就',
    'Trophies': '奖杯',
    'Coach': '教练',
    'Winrate': '胜率',
    'Status': '状态',
    'Roster timeline': '阵容时间线',
    'Date': '日期',
    'Match': '比赛',
    'Placement': '名次',
    'Tournament': '赛事',
    'Trophy': '奖杯',
    'FAQ': '常见问题',
    'All Stickers': '全部贴纸',
    'Player stats': '选手数据',
    'Upcoming & recent matches': '近期与即将进行的比赛',
    'Browse CS2 Skins': '浏览 CS2 皮肤',
    'Show loadout': '查看配装',
    'Show inventory': '查看库存',
    'Time period': '时间段',
    'Upcoming events calendar': '即将开始的赛历',

    // —— 转会页 ——
    'Counter-Strike transfers': 'CS 转会',
    'Show free agents only': '只看自由选手',
    // —— 实测补充（2026-10-26）：比赛页筛选 ——
    'Match filters': '比赛筛选',
    'Clear all': '全部清除',
    'Star': '星标',
    'Starred matches only': '只看星标比赛',
    'Region': '地区',
    'Location': '地点',
    'Set filters': '设置筛选',
    'Sort by:': '排序：',
    'Clear filters': '清除筛选',
    'Matches for you': '为你推荐的比赛',
    'No matches for you yet.': '暂无推荐比赛。',
    "Tomorrow's matches": '明日比赛',
    'Featured': '精选',
    'Today': '今天',
    'Require all players': '须包含全部选手',
    'Require all teams': '须包含全部战队',
    'Mon': '一', 'Tue': '二', 'Wed': '三', 'Thu': '四', 'Fri': '五', 'Sat': '六', 'Sun': '日',
    "Any matchup that fits one or more of the criteria set in the filter will feature in the today's matches column.": '符合任一筛选条件的对局都会显示在「今日比赛」栏中。',

    // —— 数据页 ——
    'Event filter': '赛事筛选',
    'Time filter': '时间筛选',
    'Opponent ranking': '对手排名',
    'Map filter': '地图筛选',
    'Version': '版本',
    'Quick navigation': '快速导航',
    'Best players': '最佳选手',
    'Top events': '顶级赛事',
    'Pistol rounds': '手枪局',
    'Flashbangs': '闪光弹',
    'Grenades': '投掷物',
    'Top weapons': '常用武器',
    'Navigation': '导航',
    'Overview': '总览',
    'Leaderboards': '排行榜',
    'Compare': '对比',
    '1.6 stats section': '1.6 数据专区',
    'Search stats': '搜索数据',
    'Valve Ranked': 'Valve 积分赛',
    'Country': '国家/地区',
    'Gender': '性别',
    'Men': '男子',
    'Women': '女子',
    'Age': '年龄',
    'Min age': '最小年龄',
    'Max age': '最大年龄',
    'Maps in filter': '筛选内地图',
    'Min. maps:': '最少地图数：',
    'Both sides': '双方',
    'CT Side': 'CT 方',
    'T Side': 'T 方',
    'Role': '定位',
    'Everyone': '全部',
    'Riflers': '步枪手',
    'IGLs': '指挥',
    'Rounds': '回合',
    'Firepower': '火力',
    'Entrying': '突破',
    'Trading': '补枪',
    'Opening': '首杀',
    'Closing': '残局',
    'Sniping': '狙击',
    'Utility': '道具',

    // —— 排名 / 战队页 ——
    'Valve ranking': 'Valve 排名',
    'World ranking': '世界排名',
    'Weeks in top30 for core': '核心阵容进入前 30 周数',
    'Average player age': '平均年龄',
    'For core': '核心阵容',
    'For team': '战队',
    'Current ranking': '当前排名',
    'Peak': '最高排名',
    'Time at peak': '最高排名持续',
    'STARTER': '首发',
    'BENCHED': '替补',

    // —— 选手页 ——
    'Born': '出生',
    'Current team': '当前战队',
    'Contract ends': '合同到期',
    'Certainty': '可信度',
    'Source': '来源',
    'Prize money': '奖金',
    'Player achievements': '选手成就',
    'Days in current team': '在现队天数',
    'Days in teams': '在各队天数',
    'Trusted HLTV Partner': 'HLTV 认证合作方',
    'Match verified skins': '比赛中验证过的皮肤',
    'Pistols': '手枪',
    'Rifles': '步枪',
    'Mid-Tier': '中端武器',

    // —— 转会页 / 侧栏奖项 ——
    'Date filter': '日期筛选',
    'Ranking filter': '排名筛选',
    'Country filter': '国家/地区筛选',
    'Clutches': '残局获胜',
    'AWP kills / round': '场均 AWP 击杀',
    'Forum rules': '论坛规则',
    'More news': '更多新闻',
    'See full world ranking': '查看完整世界排名',
    'See all transfers': '查看全部转会',
    'All forums': '全部论坛',
    'Quarterfinal': '四分之一决赛',
    'Semifinal': '半决赛',

    // —— 比赛详情页 ——
    'Bets': '投注',
    'Lineups': '阵容',
    'Map stats': '地图数据',
    'Past matches': '过往比赛',
    'LIVE': '直播中',
    'Watch': '观看',
    'Filter': '筛选',
    'Remember filter': '记住筛选',
    'HLTV Live': 'HLTV 直播',
    'All streams': '全部直播',
    'Scoreboard': '记分板',
    'Normal': '普通',
    'Advanced': '高级',
    'Game log': '对局日志',
    'Hide minimap': '隐藏小地图',
    'Round started': '回合开始',
    'Enemy eliminated': '敌方全灭',
    'Regional betting': '地区博彩',
    'Highlighted stats': '重点数据',
    '(Past 3 months)': '（近 3 个月）',
    'Kills per round': '场均击杀',
    'Deaths per round': '场均死亡',
    'Multi-kill rating': '多杀评分',
    'Round Swing': '回合影响力',
    'Average damage per round': '场均伤害',
    'Full comparison': '完整对比',
    'Win %': '胜率',
    'Pick %': '选图率',
    'Ban %': '禁图率',
    'Pick': '选',
    'Ban': '禁',
    'Matches, past 3 months': '近 3 个月比赛',
    'Core': '核心阵容',
    'Head to head': '历史交锋',
    'Wins': '胜场',
    'Overtimes': '加时',
    'VRS forecast': 'VRS 预测',
    'current': '当前',
    'team wins': '战队获胜',
    'If': '若',
    'team loses': '战队落败',
    'VRS invite stakes': 'VRS 邀请影响',
    'Now': '当前',
    'Win': '胜',
    'Loss': '负',

    // —— 赛事详情页 ——
    'Player Share:': '选手分成：',
    'Club Share:': '俱乐部分成：',
    'Brackets': '对阵图',
    '3rd Place Decider Match': '季军赛',
    'Group play': '小组赛',
    'Detailed view': '详细视图',
    'Simulator': '模拟器',
    'Group Swiss': '瑞士轮小组',
    'Record': '战绩',
    'Prize distribution': '奖金分配',
    'Highlights': '精彩集锦',
    'Browse highlights': '浏览集锦',
    'Back to overview': '返回总览',
    'Playing...': '播放中…',
    'Teams attending': '参赛战队',
    'Show lineups': '显示阵容',
    'VRS (Global)': 'VRS（全球）',
    'Formats': '赛制',
    'Group stage': '小组赛',
    'Swiss Bo3': '瑞士轮 Bo3',
    'Related events': '相关赛事',
    'Event data': '赛事信息',
    'Start date': '开始日期',
    'End date': '结束日期',
    'Invite date': '邀请日期',
    'VRS date': 'VRS 日期',
    'VRS weight': 'VRS 权重',
    'Total prize pool': '总奖金池',
    'Player share': '选手分成',
    'Club share': '俱乐部分成',
    'Map pool': '地图池',
    'Top 4': '前 4',
    'Else': '其他',

    // —— 新闻页 / 论坛页界面 ——
    'Jump to comments': '跳转到评论',
    'Clip link': '片段链接',
    'clip link': '片段链接',
    'Clip': '片段',
    'Share': '分享',
    'Link copied': '链接已复制',
    'Show comments': '显示评论',
    'Hide comments': '隐藏评论',
    'Load more': '加载更多',
    'Time is adjusted to your selected timezone': '时间已按你所选时区调整',
    'Past 3 months': '近 3 个月',
    'Age:': '年龄：',
    'Team:': '战队：',
    'Maps played:': '已赛地图：',
    'Subscribe': '订阅',
    'Learn what is happening - and why.': '了解发生了什么，以及为什么。',
    'Privacy Policy': '隐私政策',
    'Thread has been deleted': '该主题已被删除',
    'Topics are hidden when running Sport mode.': '体育模式下主题已隐藏。',
    'Reply': '回复',
    'Quote': '引用',
    'Report': '举报',
    'Edit': '编辑',
    'Delete': '删除',
    'AI generated': 'AI 生成',
    'Back to comment': '返回评论',
    'Short news comments': '简讯评论',
    'Live win probability': '实时胜率',
    'No promocode available': '无需优惠码',
    'Map by': '地图提供',
    'Last year': '近一年',
    'Highest Rank': '最高排名',
    'Maps played': '已赛地图',
    'Days in team': '在队天数',
    'No transfers in this time period': '该时间段内没有转会',
    'points)': '分)', // 排名页「(922<span> HLTV</span> points)」被拆成三段
    'Current win streak': '当前连胜',
    'Win rate': '胜率',
    'Ongoing & Upcoming': '进行中及即将开始',
    'Ended': '已结束',
    'Legends': '传奇组',
    '1/4 final': '八强',
    'Map win statistics past 3 months': '近 3 个月地图胜率',
    'Biggest win on map': '单图最大胜分差',
    'Biggest loss on map': '单图最大负分差',
    'Veto data': 'BP 数据',
  };

  const DICT_LOWER = {};
  for (const k of Object.keys(DICT)) DICT_LOWER[k.toLowerCase()] = DICT[k];

  const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
  const MON3 = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const WEEKDAYS = { Monday: '周一', Tuesday: '周二', Wednesday: '周三', Thursday: '周四', Friday: '周五', Saturday: '周六', Sunday: '周日' };

  // 地区 / 国家名：用浏览器自带的 Intl.DisplayNames 由 ISO 代码生成「英文名 → 中文名」，再补 HLTV 的特殊写法。
  const REGIONS = {
    'Europe': '欧洲', 'Asia': '亚洲', 'Africa': '非洲', 'Oceania': '大洋洲',
    'North America': '北美', 'South America': '南美', 'Americas': '美洲', 'CIS': '独联体', 'Other': '其他',
  };
  try {
    const en = new Intl.DisplayNames(['en'], { type: 'region' });
    const zh = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of A) for (const b of A) {
      const code = a + b;
      const e = en.of(code);
      if (e && e !== code && !(e in REGIONS)) REGIONS[e] = zh.of(code);
    }
  } catch (e) { /* 旧浏览器没有 Intl.DisplayNames，只用下面的手工表 */ }
  Object.assign(REGIONS, {
    'Hong Kong': '香港', 'Macau': '澳门', 'Macao': '澳门', 'Taiwan': '台湾',
    'Türkiye': '土耳其', 'Turkey': '土耳其', 'Czech Republic': '捷克', 'Czechia': '捷克',
    'Korea': '韩国', 'South Korea': '韩国', 'Russia': '俄罗斯', 'United States': '美国', 'USA': '美国',
    'United Kingdom': '英国', 'UK': '英国', 'Bosnia and Herzegovina': '波黑', 'Bosnia & Herzegovina': '波黑',
    'North Macedonia': '北马其顿', 'Kosovo': '科索沃', 'Vietnam': '越南', 'Iran': '伊朗', 'Syria': '叙利亚',
  });

  // 带变量的固定句式（日期、战队/选手名等原样保留）。
  const PATTERNS = [
    [/^Results for (\w+) (\d+)(?:st|nd|rd|th) (\d{4})$/, (m, mo, d, y) => MONTHS[mo] ? `${y} 年 ${MONTHS[mo]} 月 ${d} 日的结果` : m],
    [/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) - (\d{4}-\d{2}-\d{2})$/, (m, w, date) => `${WEEKDAYS[w]} - ${date}`],
    [/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/, (m, mo, y) => `${y} 年 ${MONTHS[mo]} 月`],
    [/^Top streams$/, () => '热门直播'],
    [/^(All|Casters|Streamers|Organizers)\((\d+)\)$/, (m, k, n) => `${DICT[k]}(${n})`],
    [/^Upcoming matches for (.+)$/, (m, x) => `${x} 即将进行的比赛`],
    [/^Recent results for (.+)$/, (m, x) => `${x} 近期结果`],
    [/^Latest results for (.+)$/, (m, x) => `${x} 最新结果`],
    [/^See all results for (.+)$/, (m, x) => `查看 ${x} 的全部结果`],
    [/^Match stats for (.+)$/, (m, x) => `${x} 比赛数据`],
    [/^Team stats for (.+)$/, (m, x) => `${x} 战队数据`],
    [/^Played events and leagues for (.+)$/, (m, x) => `${x} 参加过的赛事与联赛`],
    [/^All events attended by (.+)$/, (m, x) => `${x} 参加过的全部赛事`],
    [/^Breakdown of (.+?)'s Major achievements$/i, (m, x) => `${x} 的 Major 成绩明细`],
    [/^Breakdown of (.+?)'s LAN achievements$/, (m, x) => `${x} 的 LAN 成绩明细`],
    [/^Breakdown of (.+?)'s teams$/, (m, x) => `${x} 的战队经历`],
    [/^Timeline of (.+?)'s teams$/, (m, x) => `${x} 的战队时间线`],
    [/^Major achievements for (.+)$/, (m, x) => `${x} 的 Major 成绩`],
    [/^LAN achievements for (.+)$/, (m, x) => `${x} 的 LAN 成绩`],
    [/^Trophy overview for (.+)$/, (m, x) => `${x} 奖杯总览`],
    [/^All (.+?)'s trophies$/, (m, x) => `${x} 的全部奖杯`],
    [/^MVP overview for (.+)$/, (m, x) => `${x} MVP 总览`],
    [/^All (.+?)'s MVP medals$/, (m, x) => `${x} 的全部 MVP 奖牌`],
    [/^EVP overview for (.+)$/, (m, x) => `${x} EVP 总览`],
    [/^All events where (.+) was an EVP$/, (m, x) => `${x} 获得 EVP 的全部赛事`],
    [/^Top 20 overview for (.+)$/, (m, x) => `${x} Top20 总览`],
    [/^Team photos of (.+)$/, (m, x) => `${x} 战队照片`],
    [/^All photos of players for (.+)$/, (m, x) => `${x} 选手全部照片`],
    [/^Pictures of (.+)$/, (m, x) => `${x} 的照片`],
    [/^All photos of (.+)$/, (m, x) => `${x} 的全部照片`],
    [/^News posts mentioning (.+)$/, (m, x) => `提及 ${x} 的新闻`],
    [/^World ranking development for (core|team)$/, (m, x) => x === 'core' ? '核心阵容世界排名走势' : '战队世界排名走势'],
    [/^Stats from entire coach period$/, () => '执教期间全部数据'],
    [/^Stats from entire team period \*$/, () => '在队期间全部数据 *'],
    [/^(.+?) statistics$/, (m, x) => `${x} 数据`],
    [/^Complete statistics for (.+)$/, (m, x) => `${x} 完整数据`],
    [/^(.+?)'s inventory$/, (m, x) => `${x} 的库存`],
    [/^(.+?)'s skins$/, (m, x) => `${x} 的皮肤`],
    [/^(.+?)'s loadout$/, (m, x) => `${x} 的配装`],
    [/^ranked #(\d+)$/, (m, n) => `排名第 ${n}`],
    [/^(\d+)(?:st|nd|rd|th) of (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m, d, mo) => `${MON3[mo]} 月 ${d} 日`],
    [/^(\d+) (day|week|year)s?$/, (m, n, u) => `${n} ${{ day: '天', week: '周', year: '年' }[u]}`],
    [/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)$/, (m, mo) => `${MONTHS[mo[0] + mo.slice(1).toLowerCase()]} 月`],
    // 相对时间
    [/^(?:a few|a couple of) seconds? ago$/, () => '几秒前'],
    [/^(a|an|\d+) (second|minute|hour|day|week|month|year)s? ago$/, (m, n, u) => `${/^\d/.test(n) ? n : 1} ${{ second: '秒', minute: '分钟', hour: '小时', day: '天', week: '周', month: '个月', year: '年' }[u]}前`],
    [/^(?:just now|now)$/i, () => '刚刚'],
    // 地区 / 国家：「Europe (4)」「Europe (Online)」「Bucharest, Romania」（城市名保留英文）
    [/^(.+?) \((\d+)\)$/, (m, r, n) => REGIONS[r] ? `${REGIONS[r]} (${n})` : m],
    [/^(.+?) \(Online\)$/, (m, r) => REGIONS[r] ? `${REGIONS[r]}（线上）` : m],
    [/^(.+), ([^,]+)$/, (m, city, c) => REGIONS[c] ? `${city}, ${REGIONS[c]}` : m],
    [/^\((\d+) HLTV points\)$/, (m, n) => `（${n} HLTV 分）`],
    [/^(\d+) points$/, (m, n) => `${n} 分`],
    [/^\((\d+) points\)$/, (m, n) => `（${n} 分）`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+)(?:st|nd|rd|th) (\d{4})$/, (m, mo, d, y) => `${y} 年 ${MON3[mo]} 月 ${d} 日`],
    [/^Coach of (.+)$/, (m, x) => `${x} 教练`],
    [/^Who plays for (.+)\?$/, (m, x) => `${x} 的阵容是？`],
    [/^What is (.+?)'s current world rank\?$/, (m, x) => `${x} 当前世界排名是多少？`],
    // 比赛详情页：BP 顺序、地图数、VRS 预测
    [/^(\d+)\. (.+) removed (.+)$/, (m, i, t, map) => `${i}. ${t} 禁用 ${map}`],
    [/^(\d+)\. (.+) picked (.+)$/, (m, i, t, map) => `${i}. ${t} 选择 ${map}`],
    [/^(\d+)\. (.+) was left over$/, (m, i, map) => `${i}. ${map} 为剩余地图`],
    [/^(\d+) maps?$/, (m, n) => `${n} 张地图`],
    [/^(\d+) possibilit(?:y|ies)$/, (m, n) => `${n} 种可能`],
    [/^Either way ([\d.]+%)$/, (m, x) => `无论胜负 ${x}`],
    [/^Simulated (.+ ago)$/, (m, x) => { const t = translateText(x); return t ? `${t}模拟` : m; }],
    [/^(\d+) more invites? are affected$/, (m, n) => `另有 ${n} 个邀请名额受影响`],
    [/^(\d+) more invites?$/, (m, n) => `还剩 ${n} 个邀请名额`],
    [/^(\d+)(?:st|nd|rd|th) of (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/, (m, d, mo, y) => `${y} 年 ${MONTHS[mo]} 月 ${d} 日`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+)(?:st|nd|rd|th)$/, (m, mo, d) => `${MON3[mo]} 月 ${d} 日`],
    // 赛事详情页：名次、奖金分成、集锦
    [/^(\d+)(?:st|nd|rd|th)$/, (m, n) => (inPlacements() ? `第 ${n} 名` : m)],
    [/^(\d+)-(\d+)(?:st|nd|rd|th)$/, (m, a, b) => (inPlacements() ? `第 ${a}-${b} 名` : m)],
    [/^\+ Club share: (.+)$/, (m, x) => `+ 俱乐部分成：${x}`],
    [/^(\d+) views?$/, (m, n) => `${n} 次观看`],
    [/^views$/, () => '次观看'],
    [/^Day (\d+)$/, (m, n) => `第 ${n} 天`],
    [/^(\d+) highlights?$/, (m, n) => `${n} 个集锦`],
    // 新闻 / 论坛
    [/^(\d+)([mhd]) ago$/, (m, n, u) => `${n} ${{ m: '分钟', h: '小时', d: '天' }[u]}前`],
    [/^(\d+) comments?$/, (m, n) => `${n} 条评论`],
    [/^Load all \((\d+)\)$/, (m, n) => `全部加载（${n}）`],
    [/^Last comment \((\d+)\)$/, (m, n) => `最新评论（${n}）`],
    [/^Round (\d+):$/, (m, n) => `第 ${n} 回合：`],
    [/^By (\S+)$/, (m, x) => `作者：${x}`],
    [/^(\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m, d, mo) => `${MON3[mo]} 月 ${d} 日`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+), (\d{1,2}:\d{2})$/, (m, mo, d, t) => `${MON3[mo]} 月 ${d} 日 ${t}`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+) - (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d+)$/, (m, a, d1, b, d2) => `${MON3[a]} 月 ${d1} 日 - ${MON3[b]} 月 ${d2} 日`],
    [/^(\d+)(?:st|nd|rd|th) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/, (m, d, mo, y) => `${y} 年 ${MONTHS[mo]} 月 ${d} 日`],
    [/^News posts from (\d{4})$/, (m, y) => `${y} 年新闻`],
    [/^News from (\w+), (\d{4})$/, (m, mo, y) => (MONTHS[mo] ? `${y} 年 ${MONTHS[mo]} 月新闻` : m)],
    [/^(\w+), (\d{4})$/, (m, mo, y) => (MONTHS[mo] ? `${y} 年 ${MONTHS[mo]} 月` : m)],
    [/^(.+?)'s last (\d+) matches$/, (m, x, n) => `${x} 最近 ${n} 场比赛`],
    // 战队页走势图横轴的月份缩写
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m, mo) => `${MON3[mo]} 月`],
    [/^Why am I seeing$/, () => '为什么会看到'],
    [/^these matches\?$/, () => '这些比赛？'],
  ];

  // 只在这些区域里翻译（顶部导航、手机版导航、设置弹窗、左右侧栏及最右栏、主内容区）。
  const SCOPES = '#navBarContainerFull, .navcon, #navBarSmartphone, .navbar-smartphone, [class*="nav-popup"], .leftCol, .rightCol, .right2Col, .contentCol';
  // 这些区域里是动态正文，不碰：新闻正文、论坛帖子、评论、页脚、Cookie 弹窗。
  const SKIP = 'footer, #onetrust-consent-sdk, .newstext-con, .forum, .forum-topic, .post, .comment, .threading, .forum-middle, .transfer-movement, .brainbriefing-items, script, style, textarea, input, [contenteditable]';

  const DONE = new WeakMap(); // 文本节点 → 我们写入的译文，用于避免重复处理

  // 同一原文在不同位置含义不同时按所在区域覆盖。
  const CONTEXT = [
    ['[class*="nav-popup"]', { 'Day': '日间' }],
    // 排名页标签拆成「World」+「<span> ranking</span>」两段（窄屏只显示前一段）。
    ['.gtSmartphone-only', { 'ranking': '排名', 'rankings': '排名' }],
    // 「Top 20」在选手页是 HLTV 年度 Top20 榜单，只在筛选下拉和筛选按钮里译成「前 N」。
    ['option, .filter-column-content', { 'Top 5': '前 5', 'Top 10': '前 10', 'Top 20': '前 20', 'Top 30': '前 30', 'Top 50': '前 50' }],
  ];

  // 当前正在翻译的文字所在元素，供少数要看位置的句式判断。
  let curEl = null;
  const inPlacements = () => !!(curEl && curEl.closest('.placements'));

  function translateText(raw, el) {
    curEl = el || null;
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s || !/[A-Za-z]/.test(s)) return null;
    if (el) {
      for (const [sel, map] of CONTEXT) {
        if (Object.prototype.hasOwnProperty.call(map, s) && el.closest(sel)) return map[s];
      }
    }
    if (Object.prototype.hasOwnProperty.call(DICT, s)) return DICT[s];
    const lower = s.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(DICT_LOWER, lower) && s === s.toUpperCase()) return DICT_LOWER[lower];
    if (Object.prototype.hasOwnProperty.call(REGIONS, s)) return REGIONS[s];
    for (const [re, fn] of PATTERNS) {
      const m = s.match(re);
      if (m) {
        const out = fn(...m);
        if (out && out !== s) return out;
      }
    }
    return null;
  }

  function handleTextNode(node) {
    if (DONE.get(node) === node.nodeValue) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP) || !parent.closest(SCOPES)) return;
    const zh = translateText(node.nodeValue, parent);
    if (zh == null) return;
    // 没有 value 属性的 <option> 以显示文字作为提交值：先把英文原文写进 value，再改显示文字，提交的值不变。
    if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', parent.value);
    // 拆开的标签后半段（如「世界」+「 排名」）去掉前导空格，中文不需要词间空格。
    const lead = parent.matches('.gtSmartphone-only') ? '' : node.nodeValue.match(/^\s*/)[0];
    const tail = node.nodeValue.match(/\s*$/)[0];
    node.nodeValue = lead + zh + tail;
    DONE.set(node, node.nodeValue);
  }

  function handleAttrs(el) {
    for (const attr of ['placeholder', 'title']) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (!v) continue;
      const zh = translateText(v, el);
      if (zh != null) el.setAttribute(attr, zh);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) return handleTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) handleTextNode(n);
    if (root.querySelectorAll) {
      root.querySelectorAll('input[placeholder], [title]').forEach((el) => {
        if (el.closest(SCOPES) && !el.closest('footer')) handleAttrs(el);
      });
    }
    scanBlocks(root);
  }

  // ===================== 段落级处理：转会句式 + 机器翻译 =====================
  // 段落里的链接（战队、选手名）、图片、换行等子节点替换成 ⟦n⟧ 占位符，只翻文字，回填时把原节点放回原位，
  // 所以链接、事件监听都不受影响；译文里占位符对不上就放弃，保持英文。

  const PH = (i) => `⟦${i}⟧`;
  const PH_RE = /⟦(\d+)⟧/g;
  // 术语标记：必应常吞掉 ⟦n⟧ 形式的术语占位符，但会原样保留 {{PGL}} 这种写法；丢了也不影响回填。
  const TERM_MARK_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
  // 行内格式元素：本身作为占位符保留，但其内部文字另行翻译。
  const INLINE_TEXT = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BLOCKQUOTE', 'P', 'DIV', 'LI', 'SMALL']);
  // 战队页 AI 摘要把每个单词包成一个 span 做打字动画，序列化时当成普通文字。
  const FLATTEN = 'span.brainbriefing-word';

  const TERM_RE = /\b(?:Majors?|Counter-Strike|CS2|CSGO|CS:GO|HLTV|LAN|MVPs?|EVPs?|VRS|IGLs?|AWP(?:er)?s?|Rating(?: [123]\.0)?|KAST|ADR|FACEIT|Bo[135]|Top ?20|PGL|BLAST|IEM|ESL|CCT)\b/g;

  function serialize(el) {
    const parts = [];
    let text = '';
    const pre = /pre/.test(getComputedStyle(el).whiteSpace);
    const addText = (v) => {
      if (pre && v.includes('\n')) {
        v.split('\n').forEach((seg, i) => {
          if (i) { parts.push(document.createTextNode('\n')); text += PH(parts.length - 1); }
          text += seg.replace(/\s+/g, ' ');
        });
      } else {
        text += v.replace(/\s+/g, ' ');
      }
    };
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) addText(n.nodeValue);
      else if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.matches(FLATTEN) && !n.querySelector('a, img')) addText(n.textContent);
        else { parts.push(n); text += PH(parts.length - 1); }
      }
    }
    // 按用户约定保留英文的 CS 术语用 {{…}} 标记，避免被机翻意译（如 Major → 特锦赛）。
    text = text.replace(TERM_RE, (t) => `{{${t}}}`);
    return { text: text.replace(/^ +| +$/g, ''), parts };
  }

  function rebuild(el, zh, parts) {
    zh = zh.replace(TERM_MARK_RE, '$1');
    const nodes = [];
    const seen = new Set();
    let last = 0;
    let m;
    PH_RE.lastIndex = 0;
    while ((m = PH_RE.exec(zh))) {
      const i = +m[1];
      if (!parts[i] || seen.has(i)) return false;
      if (m.index > last) nodes.push(document.createTextNode(zh.slice(last, m.index)));
      nodes.push(parts[i]);
      seen.add(i);
      last = PH_RE.lastIndex;
    }
    if (seen.size !== parts.length) return false;
    if (last < zh.length) nodes.push(document.createTextNode(zh.slice(last)));
    el.replaceChildren(...nodes);
    return true;
  }

  // —— 转会动态：常见句式用模板改语序，模板不认识的句子交给机翻 ——
  const TRANSFER_TEMPLATES = [
    [/^⟦0⟧ transfers from ⟦1⟧ to ⟦2⟧ as coach$/, '⟦0⟧ 从 ⟦1⟧ 转会至 ⟦2⟧ 担任教练'],
    [/^⟦0⟧ transfers from ⟦1⟧ to ⟦2⟧$/, '⟦0⟧ 从 ⟦1⟧ 转会至 ⟦2⟧'],
    [/^⟦0⟧ joins ⟦1⟧ as coach$/, '⟦0⟧ 加入 ⟦1⟧ 担任教练'],
    [/^⟦0⟧ joins ⟦1⟧$/, '⟦0⟧ 加入 ⟦1⟧'],
    [/^⟦0⟧ is benched on ⟦1⟧$/, '⟦0⟧ 在 ⟦1⟧ 被移至替补'],
    [/^⟦0⟧ parts ways with ⟦1⟧ as coach$/, '⟦0⟧ 卸任 ⟦1⟧ 教练'],
    [/^⟦0⟧ parts ways with ⟦1⟧$/, '⟦0⟧ 与 ⟦1⟧ 分道扬镳'],
  ];
  const TRANSFER_SEL = '.transfer-movement';

  // —— 机器翻译目标：新闻标题与正文、论坛帖子与标题、比赛/赛事/战队页的描述文字 ——
  const MT_TARGETS = [
    '.newstext', '.featured-newstext', '.featured-small-newstext', 'h1.headline', '.newsgrouping-header',
    '.newstext-con > p', '.newstext-con > blockquote', '.newstext-con li',
    '.fragment-content > p', '.forum-middle', '.forum-topbar > .topic', '.activity .topic',
    'td.name > a[href^="/forums/threads/"]', '.standard-headline > a[href^="/forums/threads/"]',
    '.faq-answer > span', '.brainbriefing-item', '.brainbriefing-block-heading:not(a)','.video-discription-text > span', '.veto-box .preformatted-text',
  ].join(', ');

  const gmGet = (k, d) => (typeof GM_getValue === 'function' ? GM_getValue(k, d) : d);
  const gmSet = (k, v) => { if (typeof GM_setValue === 'function') GM_setValue(k, v); };
  const MT_ON = gmGet('mt', true);
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(`机器翻译：${MT_ON ? '已开启（点击关闭）' : '已关闭（点击开启）'}`, () => {
      gmSet('mt', !MT_ON);
      location.reload();
    });
  }

  function http(opts) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => GM_xmlhttpRequest({
        ...opts,
        timeout: 20000,
        onload: (r) => resolve({ status: r.status, text: r.responseText }),
        onerror: reject,
        ontimeout: reject,
      }));
    }
    // 浏览器自动化实测时没有油猴环境，由测试脚本注入同名的请求函数。
    if (typeof window.__hltvzhHttp === 'function') return window.__hltvzhHttp(opts);
    return Promise.reject(new Error('没有可用的跨域请求方式'));
  }
  const MT_AVAILABLE = typeof GM_xmlhttpRequest === 'function' || typeof window.__hltvzhHttp === 'function';

  // 必应网页版翻译：先从 bing.com/translator 页面取 IG / key / token，再调 ttranslatev3；token 约 1 小时过期。
  let bingAuth = null;
  async function getBingAuth() {
    if (bingAuth && Date.now() - bingAuth.at < 30 * 60 * 1000) return bingAuth;
    const r = await http({ method: 'GET', url: 'https://www.bing.com/translator' });
    const ig = r.text.match(/IG:"([A-F0-9]+)"/);
    const ap = r.text.match(/params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)"/);
    if (!ig || !ap) throw new Error('解析必应翻译页面失败');
    const iid = (r.text.match(/data-iid="(translator\.[\d.]+)"/) || [, 'translator.5023'])[1];
    bingAuth = { IG: ig[1], IID: iid, key: ap[1], token: ap[2], at: Date.now() };
    return bingAuth;
  }

  async function bingTranslate(text, retry = true) {
    const a = await getBingAuth();
    const r = await http({
      method: 'POST',
      url: `https://www.bing.com/ttranslatev3?isVertical=1&IG=${a.IG}&IID=${a.IID}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({ fromLang: 'auto-detect', to: 'zh-Hans', text, token: a.token, key: a.key }).toString(),
    });
    let j = null;
    try { j = JSON.parse(r.text); } catch (e) { /* 非 JSON 视为失败 */ }
    if (Array.isArray(j) && j[0] && j[0].translations) return j[0].translations[0].text;
    if (retry) { bingAuth = null; return bingTranslate(text, false); }
    throw new Error(`必应翻译返回异常：${r.status} ${String(r.text).slice(0, 120)}`);
  }

  // 单次请求上限约 1000 字符，留余量按 900 切。
  const MAX_CHARS = 900;
  async function translateLong(t) {
    if (t.length <= MAX_CHARS) return bingTranslate(t);
    const sents = [];
    for (const s of t.split(/(?<=[.!?]["')\]]*)\s+/)) {
      if (s.length <= MAX_CHARS) { sents.push(s + ' '); continue; }
      let rest = s;
      while (rest.length > MAX_CHARS) {
        let cut = rest.lastIndexOf(' ', MAX_CHARS);
        if (cut < MAX_CHARS / 2) cut = MAX_CHARS;
        sents.push(rest.slice(0, cut) + ' ');
        rest = rest.slice(cut);
      }
      sents.push(rest + ' ');
    }
    const chunks = [];
    let cur = '';
    for (const s of sents) {
      if ((cur + s).length > MAX_CHARS && cur) { chunks.push(cur); cur = ''; }
      cur += s;
    }
    if (cur) chunks.push(cur);
    let out = '';
    for (const c of chunks) out += await bingTranslate(c);
    return out;
  }

  // 多条短文本用换行拼成一次请求，按行拆回；行数对不上就逐条重翻。
  async function translateBatch(texts) {
    if (texts.length > 1) {
      try {
        const lines = (await bingTranslate(texts.join('\n'))).split('\n');
        if (lines.length === texts.length) return lines;
      } catch (e) { /* 整批失败就逐条重试 */ }
    }
    const out = [];
    for (const t of texts) {
      try {
        out.push(await translateLong(t));
      } catch (e) {
        console.warn('[hltv-zh] 机器翻译失败', e);
        out.push(null);
      }
    }
    return out;
  }

  // 译文缓存：存在油猴存储里，按插入顺序淘汰最旧的。
  const CACHE_KEY = 'mtcache_v2';
  // 0.2.0 的缓存键是按旧占位符写的，用不上了，清掉。
  if (gmGet('mtcache_v1', null)) gmSet('mtcache_v1', null);
  const CACHE_MAX = 4000;
  const cache = gmGet(CACHE_KEY, null) || {};
  let cacheTimer = null;
  function cachePut(k, v) {
    delete cache[k];
    cache[k] = v;
    if (cacheTimer) return;
    cacheTimer = setTimeout(() => {
      cacheTimer = null;
      const keys = Object.keys(cache);
      for (const old of keys.slice(0, Math.max(0, keys.length - CACHE_MAX))) delete cache[old];
      gmSet(CACHE_KEY, cache);
    }, 2000);
  }

  const seenBlocks = new WeakSet();
  let mtQueue = [];
  let mtTimer = null;

  // 回填前重新序列化一次：页面在等待期间改过这段内容就放弃，免得覆盖掉新内容。
  function applyMT(item, zh) {
    if (!item.el.isConnected) return;
    const cur = serialize(item.el);
    if (cur.text === item.text) rebuild(item.el, zh, cur.parts);
  }

  function mtEnqueue(el) {
    if (seenBlocks.has(el) || el.closest('[contenteditable], textarea, footer')) return;
    seenBlocks.add(el);
    const { text, parts } = serialize(el);
    // 行内子元素先入队，再判断本段是否有可译文字（如 FAQ 外层 span 只包着一个内层 span）。
    for (const c of parts) if (c.nodeType === Node.ELEMENT_NODE && INLINE_TEXT.has(c.tagName)) mtEnqueue(c);
    const plain = text.replace(PH_RE, '').replace(TERM_MARK_RE, '');
    if ((plain.match(/[A-Za-z]/g) || []).length < 3 || /[一-鿿]/.test(plain)) return;
    if (Object.prototype.hasOwnProperty.call(cache, text)) {
      rebuild(el, cache[text], parts);
      return;
    }
    mtQueue.push({ el, text });
    if (!mtTimer) mtTimer = setTimeout(mtFlush, 300);
  }

  async function mtFlush() {
    mtTimer = null;
    const groups = new Map();
    for (const it of mtQueue) {
      if (!groups.has(it.text)) groups.set(it.text, []);
      groups.get(it.text).push(it);
    }
    mtQueue = [];
    const batches = [];
    let cur = [];
    let len = 0;
    for (const t of groups.keys()) {
      if (t.length > MAX_CHARS) { batches.push([t]); continue; }
      if (len + t.length + 1 > MAX_CHARS && cur.length) { batches.push(cur); cur = []; len = 0; }
      cur.push(t);
      len += t.length + 1;
    }
    if (cur.length) batches.push(cur);
    for (const b of batches) {
      const res = await translateBatch(b);
      b.forEach((t, i) => {
        const zh = res[i] && res[i].trim();
        if (!zh) return;
        cachePut(t, zh);
        groups.get(t).forEach((it) => applyMT(it, zh));
      });
    }
  }

  function handleTransfer(el) {
    if (seenBlocks.has(el)) return;
    const { text, parts } = serialize(el);
    for (const [re, tpl] of TRANSFER_TEMPLATES) {
      if (re.test(text)) {
        seenBlocks.add(el);
        rebuild(el, tpl, parts);
        return;
      }
    }
    if (MT_ON && MT_AVAILABLE) mtEnqueue(el);
  }

  function scanBlocks(root) {
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const pick = (sel) => {
      const out = root.querySelectorAll ? [...root.querySelectorAll(sel)] : [];
      if (root.matches && root.matches(sel)) out.unshift(root);
      return out;
    };
    pick(TRANSFER_SEL).forEach(handleTransfer);
    if (MT_ON && MT_AVAILABLE) pick(MT_TARGETS).forEach(mtEnqueue);
  }

  walk(document.body);

  // 下拉菜单、侧栏、筛选器等由脚本动态插入或改写，用 MutationObserver 补译。
  let queue = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const items = queue;
    queue = new Set();
    items.forEach((n) => n.isConnected && walk(n));
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') queue.add(m.target);
      else m.addedNodes.forEach((n) => queue.add(n));
    }
    if (!scheduled && queue.size) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hltvZhMain, { once: true });
else hltvZhMain();
