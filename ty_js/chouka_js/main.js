// ================================================================
//  js/main.js  -  应用入口
//  负责：初始化、事件绑定、定时器、整合所有功能
// ================================================================

import { getSupabase, loadUserData, resetAllGachaData } from './db.js';
import { state, resetGachaData } from './state.js';
import { singlePull, tenPull, getCurrentFiveStarRate } from './gacha.js';
import {
    updateMainUI,
    renderConstellations,
    renderStats,
    renderHistory,
    showResultDialog,
    showNotification,
    updateCountdown,
    updateButtonsState,
    initUI,
    closeResultDialog,
    resetHistoryPage
} from './ui.js';
import { ITEM_TYPES } from './constants.js';

// ================================================================
//  1. 全局引用（供HTML onclick使用）
// ================================================================
window.singlePull = singlePull;
window.tenPull = tenPull;
window.showNotification = showNotification;
window.closeResultDialog = closeResultDialog;
window.openStatsModal = openStatsModal;
window.openExchangeModal = openExchangeModal;
window.openRecordModal = openRecordModal;
window.openSettingsModal = openSettingsModal;
window.openInfoModal = openInfoModal;

// ================================================================
//  2. 弹窗控制
// ================================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// 点击遮罩关闭
document.querySelectorAll('.modal-mask').forEach(mask => {
    mask.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ESC键关闭
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask.active, .result-dialog.active')
            .forEach(el => el.classList.remove('active'));
    }
});

// ================================================================
//  3. 统计弹窗
// ================================================================
function openStatsModal() {
    renderStats();
    renderConstellations();
    openModal('statsModal');
}

document.getElementById('closeStatsBtn')?.addEventListener('click', () => {
    closeModal('statsModal');
});

document.getElementById('statsBtn')?.addEventListener('click', () => {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    openStatsModal();
});

// ================================================================
//  4. 兑换弹窗
// ================================================================
function openExchangeModal() {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    document.getElementById('exchangeAmount').value = 1;
    document.getElementById('exchangePreview').innerText =
        `需要消耗 ${state.exchangeRate} 星琼`;
    openModal('exchangeModal');
}

document.getElementById('exchangeBtn')?.addEventListener('click', openExchangeModal);
document.getElementById('closeExchangeBtn')?.addEventListener('click', () => {
    closeModal('exchangeModal');
});
document.getElementById('cancelExchangeBtn')?.addEventListener('click', () => {
    closeModal('exchangeModal');
});

document.getElementById('exchangeAmount')?.addEventListener('input', function() {
    let val = parseInt(this.value) || 0;
    if (val < 1) val = 1;
    if (val > 1000) val = 1000;
    this.value = val;
    document.getElementById('exchangePreview').innerText =
        `需要消耗 ${val * state.exchangeRate} 星琼`;
});

document.getElementById('confirmExchangeBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    const amount = parseInt(document.getElementById('exchangeAmount').value) || 1;
    const cost = amount * state.exchangeRate;

    if (state.starJade >= cost) {
        state.starJade -= cost;
        state.tickets += amount;
        updateMainUI();

        // 保存到数据库
        const sb = getSupabase();
        await sb.from('user_stats').upsert({
            user_id: state.user.id,
            star_jade: state.starJade,
            tickets: state.tickets,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        showNotification(`✅ 成功兑换 ${amount} 张星轨专票`, 'success');
        closeModal('exchangeModal');
    } else {
        showNotification(`星琼不足，需要 ${cost} 星琼`, 'error');
    }
});

// ================================================================
//  5. 历史记录弹窗
// ================================================================
function openRecordModal() {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    resetHistoryPage();
    renderHistory();
    openModal('recordModal');
}

document.getElementById('openRecordBtn')?.addEventListener('click', openRecordModal);
document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    closeModal('recordModal');
});

// ================================================================
//  6. 设置弹窗
// ================================================================
function openSettingsModal() {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    openModal('settingsModal');
}

document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    closeModal('settingsModal');
});

// ---- 增加星琼 ----
document.getElementById('confirmAddJadeBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    const add = parseInt(document.getElementById('addJadeAmount').value) || 0;
    if (add > 0) {
        state.starJade += add;
        updateMainUI();
        const sb = getSupabase();
        await sb.from('user_stats').update({ star_jade: state.starJade })
            .eq('user_id', state.user.id);
        showNotification(`✅ 增加了 ${add} 星琼`, 'success');
    }
});

// ---- 增加专票 ----
document.getElementById('confirmAddTicketBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    const add = parseInt(document.getElementById('addTicketAmount').value) || 0;
    if (add > 0) {
        state.tickets += add;
        updateMainUI();
        const sb = getSupabase();
        await sb.from('user_stats').update({ tickets: state.tickets })
            .eq('user_id', state.user.id);
        showNotification(`✅ 增加了 ${add} 张星轨专票`, 'success');
    }
});

// ---- 重置命座 ----
document.getElementById('resetConstellationsBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    if (!confirm('确定清空所有命座吗？')) return;
    // 清空 inventory 中的角色
    const toDelete = [];
    for (const [key, value] of state.inventory) {
        if (value.type === ITEM_TYPES.CHARACTER) {
            toDelete.push(key);
        }
    }
    for (const key of toDelete) {
        state.inventory.delete(key);
    }
    // 保存到数据库
    const sb = getSupabase();
    await sb.from('user_inventory').delete()
        .eq('user_id', state.user.id)
        .eq('item_type', ITEM_TYPES.CHARACTER);
    renderConstellations();
    showNotification('命座已重置', 'success');
});

// ---- 重置历史 ----
document.getElementById('resetHistoryBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    if (!confirm('确定清空抽卡记录和统计吗？')) return;
    // 只清空历史，保留 inventory
    state.gachaHistory = [];
    state.totalPulls = 0;
    state.fiveStarCount = 0;
    state.fourStarCount = 0;
    state.threeStarCount = 0;
    state.upFiveStarCount = 0;
    state.fiveStarDistances = [];
    state.lastFiveStarPullIndex = 0;

    const sb = getSupabase();
    await sb.from('gacha_history').delete().eq('user_id', state.user.id);

    renderHistory();
    renderStats();
    updateMainUI();
    showNotification('历史记录已清空', 'success');
});

// ---- 重置所有数据 ----
document.getElementById('resetAllBtn')?.addEventListener('click', async function() {
    if (!state.user) return;
    if (!confirm('⚠️ 确定重置所有抽卡数据吗？\n此操作不可恢复！')) return;

    await resetAllGachaData(state.user.id);
    resetGachaData();

    // 重新加载用户数据
    await loadUserData(state.user.id);

    // 刷新所有UI
    updateMainUI();
    renderConstellations();
    renderStats();
    renderHistory();
    showNotification('✅ 所有数据已重置', 'success');
});

// ---- 星星渲染开关 ----
document.getElementById('starToggle')?.addEventListener('change', function() {
    const bg = document.getElementById('starBg');
    if (this.checked) {
        bg.classList.remove('hidden');
        // 如果没有星星，重新生成
        if (bg.children.length === 0) {
            initStars();
        }
    } else {
        bg.classList.add('hidden');
    }
    localStorage.setItem('star_render_enabled', String(this.checked));
});

// ================================================================
//  7. 规则说明弹窗
// ================================================================
function openInfoModal() {
    openModal('infoModal');
}

document.getElementById('infoBtn')?.addEventListener('click', openInfoModal);
document.getElementById('closeInfoBtn')?.addEventListener('click', () => {
    closeModal('infoModal');
});

// ================================================================
//  8. 抽卡按钮
// ================================================================
document.getElementById('singlePullBtn')?.addEventListener('click', async function() {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    if (state.isDrawing) return;

    // 检查卡池是否开放
    const now = new Date();
    if (state.bannerStart && state.bannerEnd &&
        (now < state.bannerStart || now > state.bannerEnd)) {
        showNotification('卡池未开放，无法跃迁', 'warning');
        return;
    }

    const result = await singlePull();
    if (result) {
        updateMainUI();
        renderConstellations();
        renderStats();
        renderHistory();
        showResultDialog([result]);
    }
});

document.getElementById('tenPullBtn')?.addEventListener('click', async function() {
    if (!state.user) {
        showNotification('请先登录', 'error');
        return;
    }
    if (state.isDrawing) return;

    const now = new Date();
    if (state.bannerStart && state.bannerEnd &&
        (now < state.bannerStart || now > state.bannerEnd)) {
        showNotification('卡池未开放，无法跃迁', 'warning');
        return;
    }

    const results = await tenPull();
    if (results && results.length > 0) {
        updateMainUI();
        renderConstellations();
        renderStats();
        renderHistory();
        showResultDialog(results);
    }
});

// ================================================================
//  9. 星空背景生成
// ================================================================
function initStars() {
    const starContainer = document.getElementById('starBg');
    if (!starContainer) return;
    starContainer.innerHTML = '';

    const enabled = localStorage.getItem('star_render_enabled');
    if (enabled === 'false') {
        starContainer.classList.add('hidden');
        return;
    }
    starContainer.classList.remove('hidden');

    const w = window.innerWidth;
    const starCount = w <= 480 ? 60 : (w <= 768 ? 100 : 180);
    const meteorCount = w <= 480 ? 2 : (w <= 768 ? 3 : 4);

    // 星星
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        const size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 5 + 's';
        starContainer.appendChild(star);
    }

    // 流星
    for (let i = 0; i < meteorCount; i++) {
        const meteor = document.createElement('div');
        meteor.classList.add('shooting-star');
        meteor.style.left = Math.random() * 80 + '%';
        meteor.style.top = Math.random() * 50 + '%';
        meteor.style.animationDelay = Math.random() * 8 + 's';
        starContainer.appendChild(meteor);
    }
}

// 检查星星开关状态
document.addEventListener('DOMContentLoaded', function() {
    const stored = localStorage.getItem('star_render_enabled');
    const toggle = document.getElementById('starToggle');
    if (toggle) {
        toggle.checked = stored !== 'false';
        if (!toggle.checked) {
            document.getElementById('starBg')?.classList.add('hidden');
        }
    }
});

// ================================================================
//  10. 横屏提示
// ================================================================
document.getElementById('ignoreOrientationBtn')?.addEventListener('click', function() {
    document.getElementById('orientationTip').style.display = 'none';
});

// ================================================================
//  11. ★★★ 主初始化函数 ★★★
// ================================================================
export async function init() {
    try {
        console.log('🚀 应用初始化开始...');

        // ---- 初始化UI事件 ----
        initUI();

        // ---- 生成星空 ----
        initStars();

        // ---- 获取用户会话 ----
        const sb = getSupabase();
        const { data: sessionData } = await sb.auth.getSession();

        if (!sessionData.session || !sessionData.session.user) {
            console.warn('未登录用户，请先登录');
            showNotification('请先登录以使用抽卡功能', 'warning');
            // 显示登录按钮或跳转
            return;
        }

        state.user = sessionData.session.user;
        console.log('👤 用户:', state.user.email);

        // ---- 加载用户数据 ----
        await loadUserData(state.user.id);
        console.log('✅ 用户数据加载完成');

        // ---- 更新所有UI ----
        updateMainUI();
        renderConstellations();
        renderStats();
        renderHistory();

        // ---- 启动倒计时定时器 ----
        setInterval(() => {
            updateCountdown();
            updateButtonsState();
        }, 1000);

        // ---- 初始更新倒计时 ----
        updateCountdown();
        updateButtonsState();

        console.log('✅ 应用初始化完成！');
        console.log(`📊 总抽数: ${state.totalPulls}, 五星: ${state.fiveStarCount}`);
        console.log(`📦 库存大小: ${state.inventory.size}`);

        // ---- 隐藏加载提示 ----
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

    } catch (error) {
        console.error('❌ 初始化失败:', error);
        showNotification('初始化失败: ' + error.message, 'error');
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div style="color:#f87171;padding:20px;">
                    <p>❌ 初始化失败</p>
                    <p style="font-size:0.9rem;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:10px;padding:6px 20px;background:#3b82f6;border:none;border-radius:20px;color:white;cursor:pointer;">刷新重试</button>
                </div>
            `;
        }
    }
}

// ================================================================
//  12. 自动执行初始化
// ================================================================
// 当DOM加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}