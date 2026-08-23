// ========== 管理后台入口（完整版） ==========
import { checkAuthAndRole, initSupabase, getSupabase } from './auth.js';
import { setupSidebar, switchTab } from './sidebar.js';
import { refreshUserList, applyUserSearchFilter } from './user.js';
import {
    loadContentTable,
    filterContentTable,
    showContentForm
} from './content.js';
import { initMiscPanel, resetMiscPanels } from './misc.js';
import { loadCheckinConfigs, showCheckinForm } from './checkin.js';
import {
    loadBanners,
    loadPermFive,
    loadFourStar,
    loadThreeStar,
    loadGachaConfig,
    saveGachaConfig,
    addBanner,
    addSimpleItem,
    loadAllGachaTables
} from './gacha.js';
import { refreshLogs, clearAllLogs } from './logs.js';
import './admin_char_detail.js';

// ----- 日志刷新回调（供 logAction 触发） -----
window._refreshLogsCallback = refreshLogs;

// ----- 杂项面板重置回调（供 user.js 删除用户时触发） -----
window._resetMiscPanel = resetMiscPanels;

// ----- 注册面板切换回调 -----
window._switchTabCallbacks = {
    user: refreshUserList,
    characters: () => loadContentTable('characters'),
    light_cones: () => loadContentTable('light_cones'),
    materials: () => loadContentTable('materials'),
    items: () => loadContentTable('items'),
    misc: initMiscPanel,
    checkin: loadCheckinConfigs,
    gacha: () => {
        loadBanners();
        loadPermFive();
        loadFourStar();
        loadThreeStar();
        loadGachaConfig();
    },
    logs: refreshLogs
};

// ----- 绑定页面事件 -----
function bindEvents() {
    // 1. 用户搜索
    document.getElementById('searchUsers')?.addEventListener('input', applyUserSearchFilter);

    // 2. 内容管理搜索（4个表）
    ['characters', 'light_cones', 'materials', 'items'].forEach(table => {
        const input = document.getElementById('search-' + table);
        if (input) {
            input.addEventListener('input', () => filterContentTable(table));
        }
    });

    // 3. 内容管理“添加”按钮
    document.getElementById('addCharacterBtn')?.addEventListener('click', () => showContentForm('characters'));
    document.getElementById('addLightconeBtn')?.addEventListener('click', () => showContentForm('light_cones'));
    document.getElementById('addMaterialBtn')?.addEventListener('click', () => showContentForm('materials'));
    document.getElementById('addItemBtn')?.addEventListener('click', () => showContentForm('items'));

    // 4. 签到配置“添加”按钮
    document.getElementById('addCheckinBtn')?.addEventListener('click', () => showCheckinForm(null));

    // 5. 抽卡配置按钮
    document.getElementById('addBannerBtn')?.addEventListener('click', addBanner);
    document.getElementById('addPermFiveBtn')?.addEventListener('click', () =>
        addSimpleItem('gacha_permanent_five', 'character_name')
    );
    document.getElementById('addFourStarBtn')?.addEventListener('click', () =>
        addSimpleItem('gacha_four_star', 'character_name')
    );
    document.getElementById('addThreeStarBtn')?.addEventListener('click', () =>
        addSimpleItem('gacha_three_star', 'item_name')
    );
    document.getElementById('saveConfigBtn')?.addEventListener('click', saveGachaConfig);

    // 6. 日志管理
    document.getElementById('clearLogsBtn')?.addEventListener('click', clearAllLogs);
    document.getElementById('logSearch')?.addEventListener('input', refreshLogs);
    document.getElementById('logActionFilter')?.addEventListener('change', refreshLogs);

    // 7. 退出登录
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const sb = getSupabase();
        await sb.auth.signOut();
        window.location.href = '/index.html';
    });
}

// ----- 初始化 -----
async function init() {
    const isAuthorized = await checkAuthAndRole();
    if (!isAuthorized) return;

    initSupabase();
    setupSidebar();
    bindEvents();

    // 默认加载用户管理
    await refreshUserList();
    switchTab('user');
}

init();