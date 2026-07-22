// ========== UI 渲染器 ==========
import { CONFIG, getRoleDisplay } from './config.js';
import {
    safeSetText, showNotification, openModal, closeModal,
    getLocalDateString, clearProfileCache, setCachedProfile,
    escapeHtml
} from './utils.js';
import {
    fetchUserFullData, getCheckinConfig, loadAutoSignCardStatus,
    loadAllTitles, loadUserOwnedTitles, grantTitle,
    loadUserFrames, updateUserProfile, updateUserStats
} from './api.js';
import { getSupabase } from './api.js';
import {
    getFrameById, purchaseFrame, equipFrame, applyFrameClassByFrameId,
    initFrameForUser
} from './frame-system.js';

let state = {};

export function setAppState(appState) {
    state = appState;
}

export function updateActivePointsDisplay() {
    const span = document.getElementById('activePointsValue');
    if (span) span.innerText = (state.userStats?.active_points || 0).toLocaleString();
}

export function updateShopBalanceDisplay() {
    const candySpan = document.getElementById('shopCandyBalance');
    const rainSpan = document.getElementById('shopRainbowBalance');
    const syrupSpan = document.getElementById('shopDreamySyrupBalance');
    if (candySpan) candySpan.innerText = (state.userStats?.candy_crumbles || 0).toLocaleString();
    if (rainSpan) rainSpan.innerText = (state.userStats?.rainbow_lollipops || 0).toLocaleString();
    if (syrupSpan) syrupSpan.innerText = (state.userStats?.dreamy_syrup || 0).toLocaleString();
}

export function updateCheckinButtonState() {
    const btn = document.getElementById('checkinBtn');
    if (!btn) return;
    const today = getLocalDateString();
    const checked = (state.userStats?.last_checkin_date === today);
    btn.disabled = checked;
    btn.innerHTML = checked ? '<i class="fas fa-check-circle"></i> 已签到' : '<i class="fas fa-calendar-check"></i> 签到';
}

export function updateAvatarDisplay(imageUrl) {
    const avatarDiv = document.getElementById('userAvatar');
    if (!avatarDiv) return;

    const oldFrame = document.getElementById('avatarFrameImg');
    if (oldFrame) oldFrame.remove();

    try {
        let initial = 'U';
        if (state.userProfile?.username) initial = state.userProfile.username.charAt(0).toUpperCase();
        else if (state.currentUser?.email) initial = state.currentUser.email.charAt(0).toUpperCase();

        if (imageUrl) {
            avatarDiv.innerHTML = `<img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="window.handleAvatarLoadError(this)">`;
        } else {
            avatarDiv.innerHTML = `<div class="avatar-placeholder">${initial}</div>`;
        }

        const frameImg = document.createElement('img');
        frameImg.className = 'avatar-frame-img';
        frameImg.id = 'avatarFrameImg';
        frameImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:contain;pointer-events:none;z-index:2;background:transparent!important;border:none!important;box-shadow:none!important;display:none;';
        avatarDiv.appendChild(frameImg);
        avatarDiv.classList.add('avatar');

        if (state.currentUser) {
            loadUserFrames(state.currentUser.id).then(({ equipped }) => {
                applyFrameClassByFrameId(equipped);
            }).catch(err => console.warn('头像框加载失败:', err));
        }
    } catch (err) {
        console.warn('updateAvatarDisplay 出错:', err);
        avatarDiv.innerHTML = `<div class="avatar-placeholder">U</div>`;
        avatarDiv.classList.add('avatar');
    }
}
window.handleAvatarLoadError = function(imgElement) {
    imgElement.onerror = null;
    imgElement.style.display = 'none';
    const parent = imgElement.parentElement;
    const initial = parent.getAttribute('data-initial') || 'U';
    parent.innerHTML = `<div class="avatar-placeholder">${initial}</div>`;
};

export async function renderProfile() {
    try {
        const container = document.getElementById('profileContent');
        if (!container) throw new Error('页面容器不存在');
        container.classList.remove('readonly-mode');

        const roleInfo = getRoleDisplay(state.userProfile?.role || 'user');
        const uname = state.userProfile?.username || '未知用户';
        const usernameSpan = document.getElementById('displayUsername');
        if (usernameSpan) {
            usernameSpan.innerHTML = `${uname} <span style="font-size:0.8rem;color:${roleInfo.color};">(${roleInfo.name})</span>`;
        }

        safeSetText('userEmail', state.currentUser?.email || '未登录');
        safeSetText('userBio', state.userProfile?.bio || '');
        const createdTime = state.userProfile?.created_at || state.currentUser?.created_at;
        safeSetText('createdAt', createdTime ? new Date(createdTime).toLocaleString() : '--');
        let days = createdTime ? Math.floor((new Date() - new Date(createdTime)) / 86400000) : 0;
        const daysEl = document.getElementById('userDaysText');
        if (daysEl) daysEl.innerText = `已来到 ${days.toLocaleString()} 天`;

        try {
            if (state.userProfile?.avatar_url) updateAvatarDisplay(state.userProfile.avatar_url);
            else updateAvatarDisplay(null);
        } catch (avatarErr) {
            console.warn('头像显示失败:', avatarErr);
            const avatarDiv = document.getElementById('userAvatar');
            if (avatarDiv) {
                const initial = (state.userProfile?.username || 'U').charAt(0).toUpperCase();
                avatarDiv.innerHTML = `<div class="avatar-placeholder">${initial}</div>`;
                avatarDiv.classList.add('avatar');
            }
        }

        const roleRow = document.getElementById('userRoleDisplay');
        if (roleRow) roleRow.innerHTML = `<span style="color:${roleInfo.color};">身份：${roleInfo.name}</span>`;

        if (state.userStats) {
            try {
                updateActivePointsDisplay();
                updateShopBalanceDisplay();
                const streakEl = document.getElementById('streakDays');
                if (streakEl) streakEl.innerText = (state.userStats.checkin_streak || 0).toLocaleString();
                updateCheckinButtonState();
            } catch (statsErr) {
                console.warn('统计数据显示失败:', statsErr);
            }
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('profileContent').style.display = 'block';

    } catch (err) {
        console.error('渲染页面整体失败:', err);
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div style="color: #f87171; padding: 20px; background: rgba(248,113,113,0.1); border-radius: 12px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                    <p style="margin-top: 10px; font-weight: bold;">页面渲染出错</p>
                    <p style="font-size: 0.9rem; color: #fca5a5;">错误信息：${escapeHtml(err.message || '未知错误')}</p>
                    <button onclick="location.reload()" style="margin-top: 12px; padding: 6px 20px; background: #3b82f6; color: white; border: none; border-radius: 20px; cursor: pointer;">刷新重试</button>
                </div>
            `;
            loadingDiv.style.display = 'block';
        }
        showNotification('渲染出错：' + (err.message || '未知错误'), 'error');
    }
}

// ===== 商店渲染 =====
export async function renderShop() {
    const container = document.getElementById('shopContentContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="shop-panel">
            <div class="balance-row">
                <div class="balance-item" data-currency="candy"><img src="https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Crushed_sugar.webp" style="width:20px;height:20px;object-fit:contain;">糖果碎: <span id="shopCandyBalance">0</span></div>
                <div class="balance-item" data-currency="rainbow"><img src="https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Super_Sweet.webp" style="width:20px;height:20px;object-fit:contain;">超级棒糖: <span id="shopRainbowBalance">0</span></div>
                <div class="balance-item" data-currency="dreamy_syrup"><img src="https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Dream_galaxy_syrup.webp" style="width:20px;height:20px;object-fit:contain;">星河糖浆: <span id="shopDreamySyrupBalance">0</span></div>
            </div>
            <div class="shop-tabs">
                <button class="tab-btn" data-shop-tab="frames">🖼️ 头像框</button>
                <button class="tab-btn" data-shop-tab="others">📦 其他</button>
                <button class="tab-btn active" data-shop-tab="exchange">🔄 等价交换</button>
            </div>
            <div class="shop-content">
                <div class="shop-card hide-card" data-shop-card="frames" id="framesCard"><div id="framesList">⏳ 加载中...</div></div>
                <div class="shop-card hide-card" data-shop-card="others" id="othersCard"><div id="autoSignCardItem"></div></div>
                <div class="shop-card" data-shop-card="exchange">
                    <div style="padding:10px 0;">
                        <div style="margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
                            <div style="font-weight:bold; font-size:1.1rem; margin-bottom:10px;">🍬 基础兑换区 (糖果碎 ↔ 超级棒糖)</div>
                            <div style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">汇率：10 糖果碎 = 1 超级棒糖 (双向自由互换)</div>
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <input type="number" id="lowExchangeAmount" value="1" min="1" style="flex:1; min-width:60px; background:rgba(0,0,0,0.3); border:1px solid #3d6b52; color:white; padding:6px 10px; border-radius:20px;">
                                <button class="btn-buy" onclick="window.doLowExchange('to_rainbow')">🍬 → 🌈 换棒糖</button>
                                <button class="btn-buy" onclick="window.doLowExchange('to_candy')">🌈 → 🍬 换碎糖</button>
                            </div>
                            <div id="lowExchangeMsg" style="margin-top:6px; font-size:0.85rem; color:#fbbf24;"></div>
                        </div>
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem; margin-bottom:10px;">🌌 顶级兑换区 (梦幻星河糖浆 → 下级)</div>
                            <div style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">汇率：1 星河糖浆 = 100 棒糖 = 1,000 碎糖 (不可逆向合成)</div>
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <input type="number" id="syrupExchangeAmount" value="1" min="1" style="flex:1; min-width:60px; background:rgba(0,0,0,0.3); border:1px solid #3d6b52; color:white; padding:6px 10px; border-radius:20px;">
                                <button class="btn-buy" onclick="window.doSyrupExchange('to_rainbow')" style="background:linear-gradient(135deg, #a855f7, #9333ea);">🌌 → 🌈 换棒糖</button>
                                <button class="btn-buy" onclick="window.doSyrupExchange('to_candy')" style="background:linear-gradient(135deg, #a855f7, #9333ea);">🌌 → 🍬 换碎糖</button>
                            </div>
                            <div id="syrupExchangeMsg" style="margin-top:6px; font-size:0.85rem; color:#fbbf24;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.balance-item').forEach(el => {
        el.addEventListener('click', () => {
            const currency = el.dataset.currency;
            if (currency === 'candy') showNotification('🍬 糖果碎：基础货币，签到可获得', 'info');
            else if (currency === 'rainbow') showNotification('🌈 超级棒糖：中级货币，可用于购买商品', 'info');
            else if (currency === 'dreamy_syrup') showNotification('🌌 梦幻星河糖浆：最高级货币！无法通过低级合成，仅限活动获取。', 'info');
        });
    });

    updateShopBalanceDisplay();
    try { await loadAutoSignCardUI(); } catch (e) { console.warn('加载签到卡失败', e); document.getElementById('autoSignCardItem').innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;">加载失败</div>'; }
    try { await loadFramesList(); } catch (e) { console.warn('加载头像框失败', e); document.getElementById('framesList').innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;">加载失败</div>'; }

    const shopTabs = document.querySelectorAll('.shop-tabs .tab-btn');
    const shopCards = document.querySelectorAll('.shop-card');
    shopTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const target = this.dataset.shopTab;
            shopTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            shopCards.forEach(card => {
                if (card.dataset.shopCard === target) card.classList.remove('hide-card');
                else card.classList.add('hide-card');
            });
        });
    });
}

async function loadFramesList() {
    const container = document.getElementById('framesList');
    if (!container) return;
    const { owned, equipped } = await loadUserFrames(state.currentUser.id);
    const frames = CONFIG.FRAMES;
    let html = '';
    for (const frame of frames) {
        if (frame.id === 'nature') continue;
        const isOwned = owned.includes(frame.id);
        const isEquipped = equipped === frame.id;
        let actionHtml = '';
        if (isEquipped) {
            actionHtml = `<button class="btn-owned" disabled>已装备</button>`;
        } else if (isOwned) {
            actionHtml = `<button class="btn-equip" data-frame-id="${frame.id}">装备</button>`;
        } else {
            const priceText = `🍬${frame.price_candy.toLocaleString()} ${frame.price_rainbow > 0 ? `🌈${frame.price_rainbow.toLocaleString()}` : ''}`;
            actionHtml = `<button class="btn-buy" data-frame-id="${frame.id}">购买 (${priceText})</button>`;
        }
        html += `<div class="frame-item-wrap"><div class="frame-left-box" onclick="window.openBackpackItemDetail('${frame.id}')"><div class="frame-mini-preview" style="width:44px;height:44px;overflow:hidden;border-radius:50%;">${frame.imageUrl ? `<img src="${frame.imageUrl}" style="width:100%;height:100%;object-fit:contain;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🖼️</div>`}</div><div><div style="font-weight:bold;">${frame.name}</div><div style="font-size:0.8rem; opacity:0.7;">${frame.description}</div></div></div><div>${actionHtml}</div></div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (window.isProcessing) return;
            const frameId = btn.dataset.frameId;
            try {
                await purchaseFrame(frameId, state.userStats, (newCandy, newRainbow) => {
                    state.userStats.candy_crumbles = newCandy;
                    state.userStats.rainbow_lollipops = newRainbow;
                    updateShopBalanceDisplay();
                    clearProfileCache();
                    setCachedProfile(state.userStats);
                    showNotification('🎉 购买成功！', 'success');
                    loadFramesList();
                });
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    });

    container.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (window.isProcessing) return;
            const frameId = btn.dataset.frameId;
            try {
                await equipFrame(frameId);
                showNotification('✅ 已装备头像框', 'success');
                loadFramesList();
                await applyFrameClassByFrameId(frameId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    });
}

async function loadAutoSignCardUI() {
    const container = document.getElementById('autoSignCardItem');
    if (!container) return;
    const hasCard = await loadAutoSignCardStatus(state.currentUser.id);
    const canBuy = (state.userStats?.candy_crumbles || 0) >= CONFIG.AUTO_CARD_PRICE && !hasCard;
    let html = `
        <div class="frame-item-wrap" style="display:block; text-align:center; padding:20px;">
            <div style="font-size:2rem;">📅</div>
            <div style="font-weight:bold; margin-top:8px;">自动签到卡</div>
            <div style="font-size:0.9rem; opacity:0.7;">永久有效，每天08:00自动签到（北京时间）</div>
            <div style="margin-top:12px;">
                ${hasCard ? `<span style="color:#81c784;">✅ 已拥有</span>` : `<button class="btn-buy" id="buyAutoCardBtn">购买 (🍬 ${CONFIG.AUTO_CARD_PRICE.toLocaleString()})</button>`}
            </div>
        </div>
    `;
    container.innerHTML = html;
    const buyBtn = document.getElementById('buyAutoCardBtn');
    if (buyBtn) {
        buyBtn.addEventListener('click', async () => {
            if (window.isProcessing) return;
            if (!canBuy) { showNotification(`糖果碎不足，需要 ${CONFIG.AUTO_CARD_PRICE.toLocaleString()}`, 'error'); return; }
            const sb = getSupabase();
            const { error: upsertError } = await sb.from('user_auto_sign_card').upsert({ user_id: state.currentUser.id, owned: true }, { onConflict: 'user_id' });
            if (upsertError) { showNotification('购买失败: ' + upsertError.message, 'error'); return; }
            const newCandy = (state.userStats?.candy_crumbles || 0) - CONFIG.AUTO_CARD_PRICE;
            const { error: updateError } = await sb.from('user_stats').update({ candy_crumbles: newCandy }).eq('user_id', state.currentUser.id);
            if (updateError) {
                await sb.from('user_auto_sign_card').upsert({ user_id: state.currentUser.id, owned: false }, { onConflict: 'user_id' });
                showNotification('购买失败: ' + updateError.message, 'error');
                return;
            }
            state.userStats.candy_crumbles = newCandy;
            clearProfileCache();
            setCachedProfile(state.userStats);
            updateShopBalanceDisplay();
            showNotification('🎉 自动签到卡购买成功！', 'success');
            loadAutoSignCardUI();
        });
    }
}

export async function renderBackpack() {
    const container = document.getElementById('backpackContent');
    if (!container) return;
    const hasCard = await loadAutoSignCardStatus(state.currentUser.id);
    const { owned } = await loadUserFrames(state.currentUser.id);
    const allFrames = CONFIG.FRAMES;
    const ownedFrames = allFrames.filter(f => owned.includes(f.id) && f.id !== 'nature');

    let backpackData = [
        { ...CONFIG.BACKPACK_ITEMS[0], count: state.userStats?.candy_crumbles || 0 },
        { ...CONFIG.BACKPACK_ITEMS[1], count: state.userStats?.rainbow_lollipops || 0 },
        { ...CONFIG.BACKPACK_ITEMS[2], count: state.userStats?.dreamy_syrup || 0 },
        { ...CONFIG.BACKPACK_ITEMS[3], count: hasCard ? 1 : 0 }
    ];
    for (let frame of ownedFrames) {
        backpackData.push({
            id: frame.id,
            name: frame.name,
            desc: frame.description,
            icon: frame.imageUrl || '',
            isImg: !!frame.imageUrl,
            type: 'frame',
            count: 1
        });
    }
    const filteredItems = backpackData.filter(item => {
        if (item.type === 'currency') return true;
        return item.count > 0;
    });

    let html = '';
    if (filteredItems.length === 0) {
        html = '<div class="backpack-empty">🎒 背包空空如也<br><span style="font-size:0.8rem;">去商店逛逛吧</span></div>';
    } else {
        html = '<div class="backpack-grid">';
        for (let item of filteredItems) {
            let iconHtml = '';
            const displayCount = item.count.toLocaleString();
            if (item.type === 'frame') {
                if (item.icon) {
                    iconHtml = `<img src="${item.icon}" style="width:40px;height:40px;object-fit:contain;">`;
                } else {
                    iconHtml = `<i class="fas fa-image" style="font-size:2rem;"></i>`;
                }
            } else if (item.isImg) {
                iconHtml = `<img src="${item.icon}" alt="${item.name}" style="width:40px;height:40px;object-fit:contain;">`;
            } else {
                iconHtml = `<i class="fas ${item.icon}"></i>`;
            }
            html += `<div class="backpack-item" onclick="window.openBackpackItemDetail('${item.id}')"><div class="item-icon">${iconHtml}</div><div class="item-count" style="color:#ffffff;font-weight:bold;">× ${displayCount}</div></div>`;
        }
        html += '</div>';
    }
    container.innerHTML = html;
    openModal('backpackModal');
}

export function openBackpackItemDetail(itemId) {
    const frame = getFrameById(itemId);
    if (frame) {
        let iconHtml = '';
        if (frame.imageUrl) {
            iconHtml = `<img src="${frame.imageUrl}" style="width:80px;height:80px;object-fit:contain;">`;
        } else {
            iconHtml = `<i class="fas fa-image" style="font-size:4rem;"></i>`;
        }
        document.getElementById('bItemTitle').innerText = frame.name;
        document.getElementById('bItemIcon').innerHTML = iconHtml;
        document.getElementById('bItemDesc').innerText = frame.description;
        document.getElementById('bItemCount').innerHTML = '<span style="color:#81c784;">已拥有</span>';
        openModal('backpackItemModal');
        return;
    }
    const item = CONFIG.BACKPACK_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    const iconHtml = item.isImg ? `<img src="${item.icon}" style="width:80px;height:80px;object-fit:contain;">` : `<i class="fas ${item.icon}" style="font-size:4rem;"></i>`;
    document.getElementById('bItemTitle').innerText = item.name;
    document.getElementById('bItemIcon').innerHTML = iconHtml;
    document.getElementById('bItemDesc').innerText = item.desc;
    document.getElementById('bItemCount').innerText = '';
    openModal('backpackItemModal');
}

export async function renderTitlesModal() {
    const container = document.getElementById('titlesListContainer');
    if (!container) return;
    const allTitles = await loadAllTitles();
    const ownedIds = await loadUserOwnedTitles(state.currentUser.id);
    let html = '';
    for (let title of allTitles) {
        const owned = ownedIds.includes(title.id);
        const isEquipped = (state.userProfile?.equipped_title_id === title.id);
        let nameColor = '';
        let extraIcon = '';
        if (title.is_limited) {
            if (title.name.includes('创世神')) nameColor = '#f39c12';
            else if (title.name.includes('管理神')) nameColor = '#60a5fa';
            extraIcon = '✨ ';
        }
        let conditionText = [];
        if (title.required_active_points > 0) conditionText.push(`活跃度≥${title.required_active_points.toLocaleString()}`);
        if (title.required_streak > 0) conditionText.push(`连续签到≥${title.required_streak.toLocaleString()}`);
        if (title.required_candy > 0) conditionText.push(`糖果碎≥${title.required_candy.toLocaleString()}`);
        if (title.required_rainbow > 0) conditionText.push(`超级棒糖≥${title.required_rainbow.toLocaleString()}`);
        const conditionHtml = conditionText.length ? `<div class="title-condition">${conditionText.join(' / ')}</div>` : '';
        html += `<div class="title-item"><div><div class="title-name" style="color:${nameColor || '#fff'};">${extraIcon}${title.name}</div><div class="title-desc">${title.description || ''}</div>${conditionHtml}</div><div>${owned ? (isEquipped ? '<button class="btn-owned" disabled>已装备</button>' : `<button class="btn-equip-title" data-id="${title.id}">装备</button>`) : '<span style="color:#aaa;">未获得</span>'}</div></div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.btn-equip-title').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tid = parseInt(btn.dataset.id);
            await window.equipTitle(tid);
            closeModal('titlesModal');
        });
    });
    openModal('titlesModal');
}

export async function openRewardInfoModal() {
    const sb = getSupabase();
    const { data: configData, error } = await sb.from('checkin_config').select('*').order('day_num', { ascending: true });
    if (error) { showNotification('获取奖励信息失败', 'error'); return; }
    let html = '<div style="max-height:50vh; overflow-y:auto; padding-right:8px;"><table style="width:100%; border-collapse:collapse; font-size:0.9rem;"><thead><tr style="border-bottom:2px solid var(--border-color); color:var(--text-highlight);"><th style="padding:8px 0; text-align:center;">签到天数</th><th style="padding:8px 0; text-align:center;">🍬 糖果</th><th style="padding:8px 0; text-align:center;">🌈 棒糖</th><th style="padding:8px 0; text-align:center;">⚡ 活跃</th></tr></thead><tbody>';
    let currentStreak = state.userStats?.checkin_streak || 0;
    let tomorrowReward = null;
    let fallbackReward = null;
    for (let item of configData) {
        let dayNum = item.day_num;
        if (dayNum === 9999) { fallbackReward = item; continue; }
        let isCurrent = (dayNum === currentStreak);
        let isTomorrow = (dayNum === currentStreak + 1);
        if (isTomorrow) { tomorrowReward = item; }
        let displayDay = dayNum > 30 ? '30天以上' : `第${dayNum}天`;
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${isCurrent ? 'background:rgba(255,215,0,0.15);' : ''}"><td style="padding:8px 0; text-align:center; ${isCurrent ? 'color:#facc15;font-weight:bold;' : ''}">${displayDay}</td><td style="padding:8px 0; text-align:center;">${item.candy.toLocaleString()}</td><td style="padding:8px 0; text-align:center;">${item.rainbow.toLocaleString()}</td><td style="padding:8px 0; text-align:center;">${item.active.toLocaleString()}</td></tr>`;
    }
    html += '</tbody></table></div>';
    if (!tomorrowReward) { tomorrowReward = fallbackReward || { candy: 0, rainbow: 0, active: 0 }; }
    let footerHtml =
        `<div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px; text-align:center; font-size:0.95rem; background:rgba(0,0,0,0.2); border-radius:8px; padding:12px;"><div style="color:var(--text-secondary); margin-bottom:4px;">您已连续签到 <strong style="color:#facc15; font-size:1.1rem;">${currentStreak.toLocaleString()}</strong> 天</div><div style="color:var(--text-highlight);">明天的奖励：🍬${tomorrowReward.candy.toLocaleString()} ${tomorrowReward.rainbow > 0 ? `🌈${tomorrowReward.rainbow.toLocaleString()} ` : ''}⚡${tomorrowReward.active.toLocaleString()}</div></div>`;
    const container = document.getElementById('rewardInfoContent');
    if (container) { container.innerHTML = html + footerHtml; openModal('rewardInfoModal'); }
}