// ================================================================
//  js/ui.js  -  UI渲染层（含多池子切换）
// ================================================================

import { state, getItemsByType, selectBanner } from './state.js';
import { getCurrentFiveStarRate } from './gacha.js';
import { ITEM_TYPES, FALLBACK_SPLASH } from './constants.js';
import { getBannerSplashUrl } from './db.js';

// ================================================================
//  1. DOM 缓存
// ================================================================
const dom = {
    jade: document.getElementById('jadeAmount'),
    tickets: document.getElementById('ticketAmount'),
    pity5: document.getElementById('pityCounter'),
    pity4: document.getElementById('fourPityCounter'),
    rate: document.getElementById('rateDisplay'),
    softRemain: document.getElementById('softPityRemain'),
    nextType: document.getElementById('nextFiveType'),
    fourRemain: document.getElementById('fourPityRemain'),
    poolName: document.getElementById('poolName'),
    poolSub: document.getElementById('poolSub'),
    upCharName: document.getElementById('upCharName'),
    splashImg: document.getElementById('charSplash'),
    splashCaption: document.getElementById('splashCaption'),
    disabledNotice: document.getElementById('disabledNotice'),
    countdownTimer: document.getElementById('countdownTimer'),
    uidBadge: document.getElementById('uidBadge'),
    singleBtn: document.getElementById('singlePullBtn'),
    tenBtn: document.getElementById('tenPullBtn'),
    recordList: document.getElementById('recordList'),
    dialogContent: document.getElementById('dialogContent'),
    resultDialog: document.getElementById('resultDialog'),
    statsGrid: document.getElementById('statsGrid'),
    constellationList: document.getElementById('constellationList'),
    toast: document.getElementById('toastNotice'),
    pityProgress5: document.getElementById('pityProgress5'),
    pityProgress4: document.getElementById('pityProgress4'),
    skipBtn: document.getElementById('skipFlipBtn'),
    confirmBtn: document.getElementById('confirmResultBtn'),
    ratingText: document.getElementById('ratingText'),
    resultSummary: document.getElementById('resultSummary'),
    historyPageInfo: document.getElementById('historyPageInfo'),
    historyPrevBtn: document.getElementById('historyPrevBtn'),
    historyNextBtn: document.getElementById('historyNextBtn'),
    bannerTabs: document.getElementById('bannerTabs')  // ★ 新增
};

// ================================================================
//  2. Toast 通知
// ================================================================
let toastTimer = null;

export function showNotification(msg, type = 'info') {
    const el = dom.toast;
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast-notice ' + type;
    clearTimeout(toastTimer);
    void el.offsetWidth;
    el.classList.add('show');
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, 3000);
}

// ================================================================
//  3. ★★★ 渲染池子切换 Tabs ★★★
// ================================================================
export function renderBannerTabs() {
    const container = dom.bannerTabs;
    if (!container) return;

    const banners = state.bannerList || [];
    if (banners.length <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="banner-tabs">';
    banners.forEach((b, index) => {
        const active = index === state.selectedBannerIndex ? 'active' : '';
        const isActive = state.currentBanner && state.currentBanner.banner_key === b.banner_key;
        const cls = isActive ? 'active' : '';
        html += `<button class="banner-tab ${cls}" data-index="${index}">
            ${b.name}
        </button>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // 绑定点击事件
    container.querySelectorAll('.banner-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            switchBanner(index);
        });
    });
}

// ================================================================
//  4. ★★★ 切换池子 ★★★
// ================================================================
export function switchBanner(index) {
    const banners = state.bannerList || [];
    if (index < 0 || index >= banners.length) return;
    if (index === state.selectedBannerIndex) return;

    // 调用 state.js 中的 selectBanner 更新状态
    const success = selectBanner(index);
    if (!success) return;

    // 更新 UI
    updateMainUI();
    renderBannerTabs();
    showNotification(`切换到「${state.currentBanner.name}」`, 'info');
}

// 挂载到 window 以便在 HTML 中直接调用（可选）
window.switchBanner = switchBanner;

// ================================================================
//  5. 更新主界面
// ================================================================
export function updateMainUI() {
    // ---- 资源 ----
    dom.jade.innerText = state.starJade.toLocaleString();
    dom.tickets.innerText = state.tickets.toLocaleString();

    // ---- 保底 ----
    dom.pity5.innerText = state.fiveStarPity;
    dom.pity4.innerText = state.fourStarPity;

    // ---- 概率 ----
    const rate = getCurrentFiveStarRate();
    dom.rate.innerText = `当前5星概率: ${(rate * 100).toFixed(2)}%`;

    // ---- 软保底 ----
    if (state.fiveStarPity < state.softPityStart) {
        dom.softRemain.innerText = `${state.softPityStart - state.fiveStarPity} 抽后进入软保底区`;
    } else {
        dom.softRemain.innerText = `已进入软保底区 (${state.fiveStarPity}/${state.pity5Max})`;
    }

    // ---- 下次五星类型 ----
    dom.nextType.innerText = state.guaranteedUp ? '大保底（必得UP）' : '小保底（50%概率UP）';

    // ---- 四星保底剩余 ----
    dom.fourRemain.innerText = `${state.pity4Max - state.fourStarPity} 抽后必出四星`;

    // ---- 进度条 ----
    dom.pityProgress5.style.width = Math.min((state.fiveStarPity / state.pity5Max) * 100, 100) + '%';
    dom.pityProgress4.style.width = Math.min((state.fourStarPity / state.pity4Max) * 100, 100) + '%';

    // ---- UID ----
    if (state.userNumber) {
        dom.uidBadge.innerText = `UID: ${state.userNumber}`;
    }

    // ---- 卡池信息 ----
    if (state.currentBanner) {
        dom.poolName.innerText = state.currentBanner.name || '✨ 卡池 ✨';
        dom.poolSub.innerText = state.currentBanner.sub_name || '';
        dom.upCharName.innerHTML = `🌟 ${state.upFiveStarList.join(' · ')} 🌟`;
        dom.splashImg.src = getBannerSplashUrl(state.currentBanner);
        dom.splashImg.onerror = function() {
            this.src = FALLBACK_SPLASH;
        };
        dom.splashCaption.innerText = state.currentBanner.caption || '';
    }

    // ---- 按钮状态 ----
    updateButtonsState();
}

// ================================================================
//  6. 更新按钮状态（卡池是否开放）
// ================================================================
export function updateButtonsState() {
    const now = new Date();
    const isActive = state.bannerStart && state.bannerEnd &&
        now >= state.bannerStart && now <= state.bannerEnd;

    if (!isActive) {
        dom.singleBtn.classList.add('disabled');
        dom.tenBtn.classList.add('disabled');
        dom.singleBtn.disabled = true;
        dom.tenBtn.disabled = true;
        if (dom.disabledNotice) {
            dom.disabledNotice.style.display = 'block';
            if (now < state.bannerStart) {
                dom.disabledNotice.innerText = '⏳ 卡池尚未开启，敬请期待！';
            } else {
                dom.disabledNotice.innerText = '⚠️ 卡池已结束，无法跃迁';
            }
        }
    } else {
        dom.singleBtn.classList.remove('disabled');
        dom.tenBtn.classList.remove('disabled');
        dom.singleBtn.disabled = false;
        dom.tenBtn.disabled = false;
        if (dom.disabledNotice) {
            dom.disabledNotice.style.display = 'none';
        }
    }
}

// ================================================================
//  7. 更新倒计时
// ================================================================
export function updateCountdown() {
    if (!state.bannerStart || !state.bannerEnd) {
        dom.countdownTimer.innerText = '卡池未加载';
        return;
    }

    const now = new Date();

    if (now >= state.bannerEnd) {
        dom.countdownTimer.innerText = '卡池已结束';
        return;
    }

    if (now < state.bannerStart) {
        const diff = state.bannerStart - now;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        dom.countdownTimer.innerText = `距离开启 ${days}天 ${hours}时 ${mins}分 ${secs}秒`;
        return;
    }

    const diff = state.bannerEnd - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    dom.countdownTimer.innerText = `${days}天 ${hours}时 ${mins}分 ${secs}秒`;
}

// ================================================================
//  8. 渲染命座列表
// ================================================================
export function renderConstellations() {
    const container = dom.constellationList;
    if (!container) return;

    const characters = getItemsByType(ITEM_TYPES.CHARACTER);

    if (characters.length === 0) {
        container.innerHTML = '<div style="color:#aab9de;">暂无角色命座信息</div>';
        return;
    }

    characters.sort((a, b) => b.star - a.star);

    let html = '';
    for (const char of characters) {
        const isFiveStar = char.star === 5;
        const cls = isFiveStar ? 'constellation-five' : 'constellation-four';
        const color = isFiveStar ? '#ffb347' : '#c084fc';

        html += `
            <div class="constellation-item ${cls}">
                <span class="constellation-name" style="color:${color};">${escapeHtml(char.name)}</span>
                <span class="constellation-level">(${char.level}/6)</span>
            </div>
        `;
    }

    container.innerHTML = html;
}

// ================================================================
//  9. 渲染统计面板
// ================================================================
export function renderStats() {
    const container = dom.statsGrid;
    if (!container) return;

    const avg = state.fiveStarCount === 0 ? '--' : (state.totalPulls / state.fiveStarCount).toFixed(1);
    const best = state.fiveStarDistances.length ? Math.min(...state.fiveStarDistances) : '--';
    const worst = state.fiveStarDistances.length ? Math.max(...state.fiveStarDistances) : '--';
    const upRate = state.fiveStarCount === 0 ? '--' :
        ((state.upFiveStarCount / state.fiveStarCount) * 100).toFixed(1) + '%';

    const characters = getItemsByType(ITEM_TYPES.CHARACTER);

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">🎲 总抽数</div>
            <div class="stat-number">${state.totalPulls.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">⭐ 五星数量</div>
            <div class="stat-number">${state.fiveStarCount}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">✨ 四星数量</div>
            <div class="stat-number">${state.fourStarCount}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🌀 三星数量</div>
            <div class="stat-number">${state.threeStarCount}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📊 平均出货抽数</div>
            <div class="stat-number">${avg}</div>
            <div class="stat-unit">(五星)</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🏆 最欧记录</div>
            <div class="stat-number">${best}</div>
            <div class="stat-unit">抽出五星</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">💀 最非记录</div>
            <div class="stat-number">${worst}</div>
            <div class="stat-unit">抽出五星</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🎯 UP命中率</div>
            <div class="stat-number">${upRate}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">👥 已获角色</div>
            <div class="stat-number">${characters.length}</div>
            <div class="stat-unit">个</div>
        </div>
    `;

    const rating = getRating();
    dom.ratingText.innerText = rating;
}

// ================================================================
//  10. 获取抽卡评价
// ================================================================
function getRating() {
    if (state.totalPulls === 0) return '尚未抽卡';
    if (state.fiveStarCount === 0) return '绝对的非酋';
    const avg = state.totalPulls / state.fiveStarCount;
    if (avg < 30) return '绝对的欧皇';
    if (avg < 40) return '欧皇';
    if (avg < 50) return '小欧皇';
    if (avg < 65) return '正常人';
    if (avg < 75) return '小非酋';
    if (avg < 85) return '非酋';
    return '绝对的非酋';
}

// ================================================================
//  11. 渲染历史记录（分页）
// ================================================================
let historyPage = 1;
const PAGE_SIZE = 5;

export function renderHistory() {
    const container = dom.recordList;
    if (!container) return;

    if (state.gachaHistory.length === 0) {
        container.innerHTML = '<div class="empty-history">暂无抽卡记录</div>';
        dom.historyPageInfo.innerText = '0/0';
        dom.historyPrevBtn.disabled = true;
        dom.historyNextBtn.disabled = true;
        return;
    }

    const totalPages = Math.ceil(state.gachaHistory.length / PAGE_SIZE);
    if (historyPage < 1) historyPage = 1;
    if (historyPage > totalPages) historyPage = totalPages;

    dom.historyPageInfo.innerText = `${historyPage}/${totalPages}`;
    dom.historyPrevBtn.disabled = historyPage === 1;
    dom.historyNextBtn.disabled = historyPage === totalPages;

    const start = (historyPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const visible = state.gachaHistory.slice(start, end);

    let html = '';
    for (const rec of visible) {
        let stars = '';
        if (rec.star === 5) stars = '<span class="star-gold">★★★★★</span>';
        else if (rec.star === 4) stars = '<span class="star-purple">★★★★</span>';
        else stars = '<span class="star-gray">★★★</span>';
        html += `<div class="record-item record-star${rec.star}">
            <span>${escapeHtml(rec.name)}</span>
            ${stars}
        </div>`;
    }

    const fillCount = PAGE_SIZE - visible.length;
    for (let i = 0; i < fillCount; i++) {
        html += `<div class="record-item" style="opacity:0.2;background:transparent;border-left:6px solid transparent;">&nbsp;</div>`;
    }

    container.innerHTML = html;
}

export function historyPrevPage() {
    if (historyPage > 1) {
        historyPage--;
        renderHistory();
    }
}

export function historyNextPage() {
    const totalPages = Math.ceil(state.gachaHistory.length / PAGE_SIZE);
    if (historyPage < totalPages) {
        historyPage++;
        renderHistory();
    }
}

export function resetHistoryPage() {
    historyPage = 1;
}

// ================================================================
//  12. 抽卡结果展示（卡片翻转动画）
// ================================================================
export function showResultDialog(results) {
    if (!results || results.length === 0) return;

    const container = dom.dialogContent;
    container.innerHTML = '';

    let c5 = 0, c4 = 0, c3 = 0;
    for (const r of results) {
        if (r.star === 5) c5++;
        else if (r.star === 4) c4++;
        else c3++;
    }
    dom.resultSummary.innerHTML = `
        <span class="s5">⭐5星 x${c5}</span>
        <span class="s4">✨4星 x${c4}</span>
        <span class="s3">💧3星 x${c3}</span>
    `;

    const isSingle = results.length === 1;
    const gridClass = isSingle ? 'card-grid-single' : 'card-grid-ten';
    const grid = document.createElement('div');
    grid.className = `card-grid ${gridClass}`;

    for (const item of results) {
        const cardWrap = document.createElement('div');
        cardWrap.className = 'card-wrapper';
        if (item.star === 5) {
            cardWrap.classList.add('card-five-star');
        }

        const card = document.createElement('div');
        card.className = 'card';

        const front = document.createElement('div');
        front.className = 'card-face card-front';
        const starColor = item.star === 5 ? '#ffb347' : (item.star === 4 ? '#c084fc' : '#5f7f9e');
        front.style.borderColor = starColor;

        let contentHtml = '';
        if (item.star === 5 && state.upFiveStarList.includes(item.name)) {
            const splashUrl = getBannerSplashUrl(state.currentBanner);
            contentHtml += `<img src="${splashUrl}" alt="${escapeHtml(item.name)}" class="card-splash-img">`;
        }
        contentHtml += `<div class="card-name">${escapeHtml(item.name)}</div>`;
        contentHtml += `<div class="card-star-label">${'★'.repeat(item.star)}</div>`;
        if (item.constellationMsg) {
            contentHtml += `<div class="card-extra">${escapeHtml(item.constellationMsg)}</div>`;
        }
        front.innerHTML = contentHtml;

        const back = document.createElement('div');
        let backClass = 'card-face card-back';
        if (item.star === 5) backClass += ' card-back-gold';
        else if (item.star === 4) backClass += ' card-back-purple';
        else backClass += ' card-back-blue';
        back.className = backClass;
        back.innerHTML = '<span class="card-back-icon">✦</span>';

        card.appendChild(front);
        card.appendChild(back);
        cardWrap.appendChild(card);
        grid.appendChild(cardWrap);
    }

    container.appendChild(grid);
    dom.resultDialog.classList.add('active');

    const cards = container.querySelectorAll('.card');
    let flippedCount = 0;

    cards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!this.classList.contains('flipped')) {
                this.classList.add('flipped');
                flippedCount++;
                if (flippedCount === cards.length) {
                    dom.confirmBtn.style.display = 'block';
                    dom.skipBtn.style.display = 'none';
                }
            }
        });
    });

    dom.skipBtn.style.display = results.length > 1 ? 'block' : 'none';
    dom.confirmBtn.style.display = 'none';

    dom.skipBtn.onclick = function() {
        cards.forEach(c => c.classList.add('flipped'));
        dom.confirmBtn.style.display = 'block';
        dom.skipBtn.style.display = 'none';
    };

    dom.confirmBtn.onclick = function() {
        dom.resultDialog.classList.remove('active');
        dom.confirmBtn.style.display = 'none';
        dom.skipBtn.style.display = 'none';
    };

    dom.resultDialog.addEventListener('click', function(e) {
        if (e.target === this && dom.confirmBtn.style.display !== 'none') {
            dom.confirmBtn.click();
        }
    });
}

// ================================================================
//  13. 关闭结果弹窗（全局）
// ================================================================
export function closeResultDialog() {
    dom.resultDialog.classList.remove('active');
    dom.confirmBtn.style.display = 'none';
    dom.skipBtn.style.display = 'none';
}

// ================================================================
//  14. 工具：HTML转义
// ================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
        return map[m] || m;
    });
}

// ================================================================
//  15. 挂载全局关闭函数
// ================================================================
window.closeResultDialogGlobal = closeResultDialog;

// ================================================================
//  16. 初始化UI（绑定事件）
// ================================================================
export function initUI() {
    dom.historyPrevBtn.addEventListener('click', historyPrevPage);
    dom.historyNextBtn.addEventListener('click', historyNextPage);

    window.showNotification = showNotification;
    window.renderConstellations = renderConstellations;
    window.renderStats = renderStats;
    window.renderHistory = renderHistory;
    window.showResultDialog = showResultDialog;
    window.renderBannerTabs = renderBannerTabs;

    console.log('✅ UI 初始化完成');
}