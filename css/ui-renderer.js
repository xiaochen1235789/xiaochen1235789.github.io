// ========== UI 渲染器（完整版 v2.10 - 成就积分显示） ==========
import { CONFIG, CHEST_CONFIG, getRoleDisplay } from './config.js';
import {
    safeSetText, showNotification, openModal, closeModal,
    getLocalDateString, clearProfileCache, setCachedProfile,
    escapeHtml
} from './utils.js';
import {
    fetchUserFullData, getCheckinConfig, loadAutoSignCardStatus,
    loadAllTitles, loadUserOwnedTitles, grantTitle,
    loadUserFrames, updateUserProfile, updateUserStats,
    getShopFrames, getFrameById,
    getPityCounter, getChestProbabilities, batchOpenChests, getPityLimit,
    getChestPrice,
    getAchievementsStatus,
    getMyNotifications, markNotificationRead,
    markAllNotificationsRead, deleteNotification, clearAllNotifications
} from './api.js';
import { getSupabase } from './api.js';
import {
    getFrameById as getFrameByIdSync,
    purchaseFrame, equipFrame, applyFrameClassByFrameId,
    initFrameForUser
} from './frame-system.js';

let state = {};

// 缓存商店头像框列表
let cachedFrames = null;
let framesCacheTime = 0;
const FRAMES_CACHE_TTL = 60000;

export function invalidateFramesCache() {
    cachedFrames = null;
    framesCacheTime = 0;
}

export function setAppState(appState) {
    state = appState;
}

export function updateActivePointsDisplay() {
    const span = document.getElementById('activePointsValue');
    if (span) span.innerText = (state.userStats?.active_points || 0).toLocaleString();
    // ★ 成就积分同步更新
    const apSpan = document.getElementById('achievementPointsValue');
    if (apSpan) apSpan.innerText = (state.userStats?.achievement_points || 0).toLocaleString();
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
    try {
        let initial = 'U';
        if (state.userProfile?.username) initial = state.userProfile.username.charAt(0).toUpperCase();
        else if (state.currentUser?.email) initial = state.currentUser.email.charAt(0).toUpperCase();

        let avatarImg = avatarDiv.querySelector('img:not(.avatar-frame-img)');
        let placeholder = avatarDiv.querySelector('.avatar-placeholder');

        if (imageUrl) {
            if (avatarImg) {
                if (avatarImg.src !== imageUrl) avatarImg.src = imageUrl;
            } else {
                if (placeholder) placeholder.remove();
                avatarImg = document.createElement('img');
                avatarImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
                avatarImg.onerror = function () { window.handleAvatarLoadError(this); };
                avatarImg.src = imageUrl;
                const frameImg = avatarDiv.querySelector('.avatar-frame-img');
                if (frameImg) avatarDiv.insertBefore(avatarImg, frameImg);
                else avatarDiv.appendChild(avatarImg);
            }
        } else {
            if (avatarImg) avatarImg.remove();
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.className = 'avatar-placeholder';
                avatarDiv.insertBefore(placeholder, avatarDiv.firstChild);
            }
            placeholder.textContent = initial;
        }

        let frameImg = avatarDiv.querySelector('.avatar-frame-img');
        if (!frameImg) {
            frameImg = document.createElement('img');
            frameImg.className = 'avatar-frame-img';
            frameImg.id = 'avatarFrameImg';
            frameImg.alt = '头像框';
            frameImg.src = '';
            avatarDiv.appendChild(frameImg);
        }

        avatarDiv.classList.add('avatar');
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

// ===== 主渲染 =====
export async function renderProfile() {
    try {
        const container = document.getElementById('profileContent');
        if (!container) throw new Error('页面容器不存在');
        container.classList.remove('readonly-mode');

        const roleInfo = getRoleDisplay(state.userProfile?.role || 'user', state.currentUser?.id);
        const uname = state.userProfile?.username || '未知用户';
        const usernameSpan = document.getElementById('displayUsername');
        if (usernameSpan) usernameSpan.innerHTML = `${uname}`;

        safeSetText('userEmail', state.currentUser?.email || '未登录');
        safeSetText('userBio', state.userProfile?.bio || '');
        const createdTime = state.userProfile?.created_at || state.currentUser?.created_at;
        safeSetText('createdAt', createdTime ? new Date(createdTime).toLocaleString() : '--');
        let days = createdTime ? Math.floor((new Date() - new Date(createdTime)) / 86400000) : 0;
        const daysEl = document.getElementById('userDaysText');
        if (daysEl) daysEl.innerText = `已来到 ${days.toLocaleString()} 天`;

        if (state.userProfile?.avatar_url) updateAvatarDisplay(state.userProfile.avatar_url);
        else updateAvatarDisplay(null);

        const roleRow = document.getElementById('userRoleDisplay');
        if (roleRow) roleRow.innerHTML = `<span style="color:${roleInfo.color};">身份：${roleInfo.name}</span>`;

        if (state.userStats) {
            updateActivePointsDisplay();
            updateShopBalanceDisplay();
            const streakEl = document.getElementById('streakDays');
            if (streakEl) streakEl.innerText = (state.userStats.checkin_streak || 0).toLocaleString();
            updateCheckinButtonState();

            // ★ 成就积分显示
            const apEl = document.getElementById('achievementPointsValue');
            if (apEl) apEl.innerText = (state.userStats.achievement_points || 0).toLocaleString();
        }

        const userInfo = document.querySelector('.user-info');
        if (userInfo && !document.getElementById('chestDisplay')) {
            const chestDiv = document.createElement('div');
            chestDiv.className = 'chest-info';
            chestDiv.id = 'chestDisplay';
            chestDiv.innerHTML = `🎁 宝箱：${(state.userStats?.chest_count || 0).toLocaleString()}`;
            const wrapper = userInfo.querySelector('.username-wrapper');
            if (wrapper) wrapper.after(chestDiv);
            else userInfo.appendChild(chestDiv);
        } else {
            const chestEl = document.getElementById('chestDisplay');
            if (chestEl) chestEl.textContent = `🎁 宝箱：${(state.userStats?.chest_count || 0).toLocaleString()}`;
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

// ===== 商店 =====
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
                <div class="shop-card hide-card" data-shop-card="others" id="othersCard">
                    <div id="autoSignCardItem"></div>
                    <div id="chestShopItem"></div>
                </div>
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

    await Promise.all([
        loadAutoSignCardUI().catch(e => {
            console.warn('加载签到卡失败', e);
            const el = document.getElementById('autoSignCardItem');
            if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;">加载失败</div>';
        }),
        loadFramesList().catch(e => {
            console.warn('加载头像框失败', e);
            const el = document.getElementById('framesList');
            if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;">加载失败</div>';
        }),
        loadChestShopUI().catch(e => {
            console.warn('加载宝箱商店失败', e);
            const el = document.getElementById('chestShopItem');
            if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;">加载失败</div>';
        })
    ]);

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

// ===== 加载头像框列表 =====
async function loadFramesList() {
    const container = document.getElementById('framesList');
    if (!container) return;

    const [frames, userFrames] = await Promise.all([
        (async () => {
            if (cachedFrames && Date.now() - framesCacheTime <= FRAMES_CACHE_TTL) return cachedFrames;
            const f = await getShopFrames();
            cachedFrames = f;
            framesCacheTime = Date.now();
            return f;
        })(),
        loadUserFrames(state.currentUser.id)
    ]);
    const { owned, equipped } = userFrames;

    let html = '';
    for (const frame of frames) {
        if (frame.id === 'nature') continue;

        let imageUrl = frame.imageUrl || frame.image_url || '';
        if (!imageUrl) {
            const configFrame = CONFIG.FRAMES.find(f => f.id === frame.id);
            if (configFrame && configFrame.imageUrl) imageUrl = configFrame.imageUrl;
        }

        const isOwned = owned.includes(frame.id);
        const isEquipped = equipped === frame.id;
        let actionHtml = '';
        if (isEquipped) {
            actionHtml = `<button class="btn-owned" disabled>已装备</button>`;
        } else if (isOwned) {
            actionHtml = `<button class="btn-equip" data-frame-id="${frame.id}">装备</button>`;
        } else if (frame.is_chest_exclusive) {
            actionHtml = `<span style="color:#facc15;font-size:0.8rem;">🎁 仅限宝箱获得</span>`;
        } else if (frame.is_purchasable) {
            const priceText = `🍬${frame.price_candy?.toLocaleString() || 0} ${frame.price_rainbow > 0 ? `🌈${frame.price_rainbow.toLocaleString()}` : ''}`;
            actionHtml = `<button class="btn-buy" data-frame-id="${frame.id}">购买 (${priceText})</button>`;
        } else {
            actionHtml = `<span style="color:#aaa;">不可购买</span>`;
        }

        html += `<div class="frame-item-wrap">
            <div class="frame-left-box" onclick="window.openBackpackItemDetail('${frame.id}')">
                <div class="frame-mini-preview">
                    ${imageUrl ? `<img src="${imageUrl}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:1.5rem;\\'>🖼️</span>';">` : `<span style="font-size:1.5rem;">🖼️</span>`}
                </div>
                <div>
                    <div style="font-weight:bold;">${frame.name}</div>
                    <div style="font-size:0.8rem; opacity:0.7;">${frame.description || ''}</div>
                </div>
            </div>
            <div>${actionHtml}</div>
        </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (window.isProcessing) return;
            const frameId = btn.dataset.frameId;
            try {
                await purchaseFrame(frameId, state.userStats, (newCandy, newRainbow) => {
                    state.userStats.candy_crumbles = newCandy;
                    state.userStats.rainbow_lollipops = newRainbow;
                    updateShopBalanceDisplay();
                    clearProfileCache();
                    setCachedProfile(
                        { ...(state.userProfile || {}), ...(state.userStats || {}) },
                        state.currentUser?.id
                    );
                    invalidateFramesCache();
                    showNotification('🎉 购买成功！', 'success');
                    window.refreshAchievements?.().catch(() => {});
                    loadFramesList();
                });
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    });

    container.querySelectorAll('.btn-equip').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (window.isProcessing) return;
            const frameId = btn.dataset.frameId;
            try {
                await equipFrame(frameId);
                state.userProfile.equipped_frame = frameId;
                window.userProfile.equipped_frame = frameId;
                showNotification('✅ 已装备头像框', 'success');
                loadFramesList();
                await applyFrameClassByFrameId(frameId);
                window.updateNavbar?.();
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
    let html = `
        <div class="frame-item-wrap" style="display:block; text-align:center; padding:20px;">
            <div style="font-size:2rem;">📅</div>
            <div style="font-weight:bold; margin-top:8px;">自动签到卡</div>
            <div style="font-size:0.9rem; opacity:0.7;">永久有效，每天凌晨00:00自动签到（北京时间）</div>
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
            window.isProcessing = true;
            try {
                const sb = getSupabase();
                const { data, error } = await sb.rpc('purchase_auto_card', {
                    p_user_id: state.currentUser.id
                });
                if (error) {
                    showNotification(error.message, 'error');
                    return;
                }
                state.userStats.candy_crumbles = data.new_candy;
                state.hasAutoSignCard = true;
                clearProfileCache();
                setCachedProfile(
                    { ...(state.userProfile || {}), ...(state.userStats || {}) },
                    state.currentUser?.id
                );
                updateShopBalanceDisplay();
                showNotification('🎉 自动签到卡购买成功！', 'success');
                loadAutoSignCardUI();
            } finally {
                window.isProcessing = false;
            }
        });
    }
}

async function loadChestShopUI() {
    const container = document.getElementById('chestShopItem');
    if (!container) return;
    const price = await getChestPrice();
    const maxBuy = CHEST_CONFIG.max_purchase;
    const currentChests = state.userStats?.chest_count || 0;
    let html = `
        <div class="frame-item-wrap" style="display:block; text-align:center; padding:20px; border-top:1px solid rgba(255,255,255,0.1); margin-top:10px;">
            <div style="font-size:2rem;">🎁</div>
            <div style="font-weight:bold; margin-top:8px;">神秘宝箱</div>
            <div style="font-size:0.9rem; opacity:0.7;">开启可获得随机奖励！每日登录赠送1个</div>
            <div style="margin-top:8px; display:flex; justify-content:center; align-items:center; gap:8px; flex-wrap:wrap;">
                <input type="number" id="chestBuyAmount" value="1" min="1" max="${maxBuy}" style="width:60px; background:rgba(0,0,0,0.3); border:1px solid #3d6b52; color:white; padding:4px 6px; border-radius:10px; text-align:center;">
                <span style="font-size:0.9rem;">🍬 ${price} / 个</span>
                <button class="btn-buy" id="buyChestBtn">购买</button>
            </div>
            <div style="margin-top:6px; font-size:0.85rem; color:var(--text-secondary);">当前拥有：${currentChests.toLocaleString()} 个</div>
        </div>
    `;
    container.innerHTML = html;
    document.getElementById('buyChestBtn')?.addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('chestBuyAmount').value) || 0;
        if (amount < 1 || amount > maxBuy) {
            showNotification(`购买数量必须在 1 ~ ${maxBuy} 之间`, 'error');
            return;
        }
        if (window.isProcessing) return;
        window.isProcessing = true;
        try {
            const sb = getSupabase();
            const { data, error } = await sb.rpc('purchase_chests', {
                p_user_id: state.currentUser.id,
                p_amount: amount
            });
            if (error) {
                showNotification(error.message, 'error');
                return;
            }
            state.userStats.candy_crumbles = data.new_candy;
            state.userStats.chest_count    = data.new_chest;
            window.userStats = state.userStats;
            clearProfileCache();
            setCachedProfile(
                { ...(state.userProfile || {}), ...(state.userStats || {}) },
                state.currentUser?.id
            );
            updateShopBalanceDisplay();
            window.updateChestDisplay?.();
            loadChestShopUI();
            showNotification(`✅ 成功购买 ${amount} 个宝箱`, 'success');
            window.refreshAchievements?.().catch(() => {});
        } finally {
            window.isProcessing = false;
        }
    });
}

// ===== 背包 =====
export async function renderBackpack() {
    const container = document.getElementById('backpackContent');
    if (!container) return;

    const [hasCard, userFrames, allFrames] = await Promise.all([
        loadAutoSignCardStatus(state.currentUser.id).catch(() => false),
        loadUserFrames(state.currentUser.id),
        (async () => {
            if (cachedFrames && Date.now() - framesCacheTime <= FRAMES_CACHE_TTL) return cachedFrames;
            const f = await getShopFrames();
            cachedFrames = f;
            framesCacheTime = Date.now();
            return f;
        })()
    ]);
    const { owned } = userFrames;
    const ownedFrames = allFrames.filter(f => owned.includes(f.id) && f.id !== 'nature');

    let backpackData = [
        { ...CONFIG.BACKPACK_ITEMS[0], count: state.userStats?.candy_crumbles || 0 },
        { ...CONFIG.BACKPACK_ITEMS[1], count: state.userStats?.rainbow_lollipops || 0 },
        { ...CONFIG.BACKPACK_ITEMS[2], count: state.userStats?.dreamy_syrup || 0 },
        { ...CONFIG.BACKPACK_ITEMS[3], count: hasCard ? 1 : 0 }
    ];

    for (let frame of ownedFrames) {
        let iconUrl = frame.imageUrl || frame.image_url || '';
        if (!iconUrl) {
            const configFrame = CONFIG.FRAMES.find(f => f.id === frame.id);
            if (configFrame && configFrame.imageUrl) iconUrl = configFrame.imageUrl;
        }
        backpackData.push({
            id: frame.id,
            name: frame.name,
            desc: frame.description,
            icon: iconUrl || '',
            isImg: !!iconUrl,
            type: 'frame',
            count: 1
        });
    }

    const chestCount = state.userStats?.chest_count || 0;
    if (chestCount > 0) {
        backpackData.push({
            id: 'chest',
            name: '神秘宝箱',
            desc: '开启可获得随机奖励，每日登录赠送1个',
            icon: CHEST_CONFIG.image_url,
            isImg: true,
            type: 'chest',
            count: chestCount
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
                    iconHtml = `<img src="${item.icon}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size:1.5rem;\\'>🖼️</span>';">`;
                } else {
                    iconHtml = `<span style="font-size:1.5rem;">🖼️</span>`;
                }
            } else if (item.isImg) {
                iconHtml = `<img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none';">`;
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

// ===== 物品详情 =====
export async function openBackpackItemDetail(itemId) {
    let frame = getFrameByIdSync(itemId);
    if (!frame) {
        frame = await getFrameById(itemId);
    }
    if (frame) {
        const ownedFrames = state.userProfile?.owned_frames || ['nature'];
        const count = ownedFrames.includes(frame.id) ? 1 : 0;
        const isEquipped = state.userProfile?.equipped_frame === frame.id;

        let imageUrl = frame.imageUrl || frame.image_url || '';
        if (!imageUrl) {
            const configFrame = CONFIG.FRAMES.find(f => f.id === frame.id);
            if (configFrame && configFrame.imageUrl) imageUrl = configFrame.imageUrl;
        }

        document.getElementById('bItemTitle').innerText = frame.name;
        document.getElementById('bItemIcon').innerHTML = imageUrl
            ? `<img src="${imageUrl}" style="width:80px;height:80px;object-fit:contain;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:3rem;\\'>🖼️</span>';">`
            : `<span style="font-size:3rem;">🖼️</span>`;
        document.getElementById('bItemDesc').innerText = frame.description || '';

        let actionHtml = '';
        if (count > 0) {
            if (isEquipped) {
                actionHtml = `<button class="btn-owned" disabled style="margin-top:12px;">已装备</button>`;
            } else {
                actionHtml = `<button class="btn-primary" id="equipFromBackpackBtn" style="margin-top:12px;">装备此头像框</button>`;
            }
        }
        document.getElementById('bItemCount').innerHTML = `当前拥有：${count}${actionHtml}`;

        openModal('backpackItemModal');

        const equipBtn = document.getElementById('equipFromBackpackBtn');
        if (equipBtn) {
            equipBtn.addEventListener('click', async () => {
                try {
                    await equipFrame(frame.id);
                    state.userProfile.equipped_frame = frame.id;
                    window.userProfile.equipped_frame = frame.id;
                    showNotification('✅ 已装备头像框', 'success');
                    closeModal('backpackItemModal');
                    renderBackpack();
                    applyFrameClassByFrameId(frame.id);
                    window.updateNavbar?.();
                } catch (err) {
                    showNotification(err.message, 'error');
                }
            });
        }
        return;
    }

    const item = CONFIG.BACKPACK_ITEMS.find(i => i.id === itemId);
    if (item) {
        let count = 0;
        if (item.type === 'currency') {
            if (item.id === 'candy') count = state.userStats?.candy_crumbles || 0;
            else if (item.id === 'rainbow') count = state.userStats?.rainbow_lollipops || 0;
            else if (item.id === 'dreamy_syrup') count = state.userStats?.dreamy_syrup || 0;
        } else if (item.id === 'autocard') {
            count = state.hasAutoSignCard ? 1 : 0;
        }
        document.getElementById('bItemTitle').innerText = item.name;
        const iconHtml = item.isImg ? `<img src="${item.icon}" style="width:80px;height:80px;object-fit:contain;" onerror="this.style.display='none';">` : `<i class="fas ${item.icon}" style="font-size:4rem;"></i>`;
        document.getElementById('bItemIcon').innerHTML = iconHtml;
        document.getElementById('bItemDesc').innerText = item.desc;
        document.getElementById('bItemCount').innerHTML = `当前拥有：${count}`;
        openModal('backpackItemModal');
        return;
    }

    if (itemId === 'chest') {
        const count = state.userStats?.chest_count || 0;
        if (count < 1) {
            showNotification('没有宝箱可开启', 'warning');
            return;
        }
        openBatchChestModal(count);
        return;
    }

    showNotification('未知物品', 'error');
}

// ============================================================
// 宝箱开启界面
// ============================================================
let batchModalOpen = false;
let isOpeningChest = false;

export async function openBatchChestModal(maxCount) {
    if (batchModalOpen) return;
    batchModalOpen = true;
    isOpeningChest = false;

    let pityCounter = 0;
    try {
        pityCounter = await getPityCounter(state.currentUser.id);
    } catch (e) { console.warn('获取保底计数失败', e); }
    const pityLimit = await getPityLimit();
    const remaining = Math.max(0, pityLimit - pityCounter);
    const openedCount = pityCounter;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.id = 'batchChestModal';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 420px;">
            <div class="modal-header">
                <div class="modal-title">
                    <i class="fas fa-box-open"></i> 开启宝箱
                    <button id="chestHelpBtn" style="background:none;border:none;color:#60a5fa;font-size:1.2rem;cursor:pointer;margin-left:8px;" title="查看完整概率表">
                        <i class="fas fa-question-circle"></i>
                    </button>
                </div>
                <button class="modal-close" id="closeBatchChestBtn">&times;</button>
            </div>
            <div style="text-align:center; padding:10px 0;">
                <img src="${CHEST_CONFIG.image_url}" alt="宝箱" style="width:80px; height:80px; object-fit:contain;">
                <div style="margin:10px 0; font-size:0.95rem;">
                    当前拥有 <strong id="chestCountDisplay">${maxCount}</strong> 个宝箱
                </div>
                <div id="pityProgress" style="font-size:0.85rem; color:#facc15; background:rgba(0,0,0,0.3); padding:6px 12px; border-radius:20px; display:inline-block; margin-bottom:10px;">
                    已开启 <strong>${openedCount}</strong> 次（未出限定），距离保底剩余 <strong>${remaining}</strong> 次
                </div>
                <div style="display:flex; align-items:center; gap:12px; justify-content:center;">
                    <span>开启数量：</span>
                    <input type="range" id="chestSlider" min="1" max="${Math.min(maxCount, 100)}" value="${Math.min(10, maxCount, 100)}" style="flex:1; max-width:200px;">
                    <span id="chestSliderValue">${Math.min(10, maxCount, 100)}</span>
                </div>
                <div style="display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
                    <button id="openOnceBtn" class="btn-buy" style="padding:6px 18px;">开一次</button>
                    <button id="openTenBtn" class="btn-buy" style="padding:6px 18px;">开十次</button>
                    <button id="confirmBatchOpenBtn" class="btn-primary" style="padding:6px 18px;">确认开启</button>
                </div>
                <div id="batchResultArea" style="display:none;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const slider = document.getElementById('chestSlider');
    const valueDisplay = document.getElementById('chestSliderValue');
    const confirmBtn = document.getElementById('confirmBatchOpenBtn');
    const openOnceBtn = document.getElementById('openOnceBtn');
    const openTenBtn = document.getElementById('openTenBtn');
    const closeBtn = document.getElementById('closeBatchChestBtn');
    const pityDisplay = document.getElementById('pityProgress');
    const chestCountDisplay = document.getElementById('chestCountDisplay');

    async function updatePityDisplay() {
        try {
            const newCounter = await getPityCounter(state.currentUser.id);
            const newRemaining = Math.max(0, pityLimit - newCounter);
            pityDisplay.innerHTML = `已开启 <strong>${newCounter}</strong> 次（未出限定），距离保底剩余 <strong>${newRemaining}</strong> 次`;
        } catch (e) { console.warn('更新保底显示失败', e); }
    }

    function updateChestCountDisplay() {
        const count = state.userStats?.chest_count || 0;
        chestCountDisplay.textContent = count;
        const maxVal = Math.min(count, 100);
        slider.max = maxVal;
        if (parseInt(slider.value) > maxVal) {
            slider.value = maxVal;
            valueDisplay.textContent = maxVal;
        }
        if (maxVal < 1) {
            setButtonsDisabled(true);
        } else {
            if (!isOpeningChest) setButtonsDisabled(false);
        }
    }

    function setButtonsDisabled(disabled) {
        slider.disabled = disabled;
        openOnceBtn.disabled = disabled;
        openTenBtn.disabled = disabled;
        confirmBtn.disabled = disabled;
        closeBtn.disabled = disabled;
        isOpeningChest = disabled;
    }

    function showChestResultModal(results) {
        const summary = {};
        results.forEach(r => {
            const key = r.type;
            summary[key] = (summary[key] || 0) + 1;
        });
        let lines = [];
        for (let key in summary) {
            lines.push(`${key} ×${summary[key]}`);
        }

        const resultOverlay = document.createElement('div');
        resultOverlay.className = 'modal-overlay show';
        resultOverlay.id = 'chestResultModal';
        resultOverlay.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-gift"></i> 开箱结果</div>
                    <button class="modal-close" id="closeChestResultBtn">&times;</button>
                </div>
                <div style="padding: 16px 0; text-align: center;">
                    <div style="font-size:1.2rem; margin-bottom:12px;">🎉 成功开启 ${results.length} 个宝箱</div>
                    <div style="max-height:200px; overflow-y:auto; text-align:left; padding:0 12px;">
                        ${lines.map(line => `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">${line}</div>`).join('')}
                    </div>
                    <button class="btn-primary" id="closeChestResultConfirm" style="margin-top:16px;">知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(resultOverlay);

        const closeResult = () => { resultOverlay.remove(); };
        document.getElementById('closeChestResultBtn').addEventListener('click', closeResult);
        document.getElementById('closeChestResultConfirm').addEventListener('click', closeResult);
        resultOverlay.addEventListener('click', (e) => {
            if (e.target === resultOverlay) closeResult();
        });
    }

    async function performOpen(amount) {
        if (isOpeningChest) return;
        const currentCount = state.userStats?.chest_count || 0;
        if (currentCount < amount || amount < 1) {
            showNotification('宝箱数量不足', 'error');
            return;
        }
        setButtonsDisabled(true);
        try {
            const { results, newStats } = await batchOpenChests(state.currentUser.id, amount);
            state.userStats = newStats;
            window.userStats = newStats;
            clearProfileCache();
            setCachedProfile(
                { ...(state.userProfile || {}), ...(state.userStats || {}) },
                state.currentUser?.id
            );
            updateChestCountDisplay();
            updatePityDisplay();
            showChestResultModal(results);
            if (newStats.chest_count === 0) {
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                    batchModalOpen = false;
                }, 1500);
            }
            showNotification(`✅ 成功开启 ${amount} 个宝箱`, 'success');
            window.refreshAchievements?.().catch(() => {});
        } catch (err) {
            showNotification('开箱失败：' + err.message, 'error');
        } finally {
            if ((state.userStats?.chest_count || 0) > 0) setButtonsDisabled(false);
            else setButtonsDisabled(true);
        }
    }

    slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
    });

    closeBtn.addEventListener('click', () => {
        if (isOpeningChest) return;
        overlay.remove();
        batchModalOpen = false;
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !isOpeningChest) {
            overlay.remove();
            batchModalOpen = false;
        }
    });

    document.getElementById('chestHelpBtn').addEventListener('click', async () => {
        try {
            const probs = await getChestProbabilities();
            const totalWeight = probs.reduce((s, p) => s + p.weight, 0);
            const pityLimit2 = await getPityLimit();
            const currentCounter = await getPityCounter(state.currentUser.id);
            const remain = Math.max(0, pityLimit2 - currentCounter);

            let html = `<div style="font-weight:bold;margin-bottom:10px;font-size:1.1rem;">🎲 完整奖励配置表</div>`;
            const normal = probs.filter(p => !p.is_limited);
            const limited = probs.filter(p => p.is_limited);
            html += `<div style="border-bottom:1px solid #333;padding-bottom:8px;margin-bottom:8px;">【普通奖励】</div>`;
            for (let p of normal) {
                const percent = ((p.weight / totalWeight) * 100).toFixed(1);
                html += `<div>${p.description}：${percent}%</div>`;
            }
            if (limited.length) {
                html += `<div style="margin-top:10px;border-top:1px solid #444;padding-top:10px;color:#facc15;">【限定奖励】（保底 ${pityLimit2} 次必出）</div>`;
                for (let p of limited) {
                    const percent = ((p.weight / totalWeight) * 100).toFixed(1);
                    html += `<div>${p.description}：${percent}%</div>`;
                }
                html += `<div style="margin-top:8px;font-size:0.85rem;color:#f87171;">💡 保底规则：若连续 ${pityLimit2-1} 次未出限定，第 ${pityLimit2} 次必定获得一个限定物品（从所有限定中随机）</div>`;
            } else {
                html += `<div style="margin-top:8px;color:#aaa;">暂无限定物品配置</div>`;
            }
            html += `<div style="margin-top:12px;border-top:1px solid #333;padding-top:10px;font-size:0.9rem;color:#facc15;">📊 当前保底进度：已开启 ${currentCounter} 次，距离保底还差 ${remain} 次</div>`;

            const helpOverlay = document.createElement('div');
            helpOverlay.className = 'modal-overlay show';
            helpOverlay.id = 'chestProbModal';
            helpOverlay.innerHTML = `
                <div class="modal" style="max-width: 420px;">
                    <div class="modal-header">
                        <div class="modal-title"><i class="fas fa-info-circle"></i> 宝箱概率详情</div>
                        <button class="modal-close" id="closeChestProbBtn">&times;</button>
                    </div>
                    <div style="padding: 8px 0; max-height: 60vh; overflow-y: auto;">
                        ${html}
                    </div>
                    <div style="text-align:center; padding:10px 0 0;">
                        <button class="btn-primary" id="closeChestProbConfirm">知道了</button>
                    </div>
                </div>
            `;
            document.body.appendChild(helpOverlay);

            const closeProb = () => { helpOverlay.remove(); };
            document.getElementById('closeChestProbBtn').addEventListener('click', closeProb);
            document.getElementById('closeChestProbConfirm').addEventListener('click', closeProb);
            helpOverlay.addEventListener('click', (e) => {
                if (e.target === helpOverlay) closeProb();
            });
        } catch (err) {
            showNotification('加载配置表失败', 'error');
        }
    });

    confirmBtn.addEventListener('click', () => {
        if (isOpeningChest) return;
        const amount = parseInt(slider.value);
        if (amount < 1) {
            showNotification('至少开启1个', 'error');
            return;
        }
        performOpen(amount);
    });

    openOnceBtn.addEventListener('click', () => {
        if (isOpeningChest) return;
        const currentCount = state.userStats?.chest_count || 0;
        if (currentCount < 1) {
            showNotification('没有宝箱可开启', 'error');
            return;
        }
        slider.value = 1;
        valueDisplay.textContent = '1';
        performOpen(1);
    });

    openTenBtn.addEventListener('click', () => {
        if (isOpeningChest) return;
        const currentCount = state.userStats?.chest_count || 0;
        const amount = Math.min(10, currentCount);
        if (amount < 1) {
            showNotification('没有宝箱可开启', 'error');
            return;
        }
        slider.value = amount;
        valueDisplay.textContent = amount;
        performOpen(amount);
    });

    updateChestCountDisplay();
}

// ===== 称号 =====
export async function renderTitlesModal() {
    const container = document.getElementById('titlesListContainer');
    if (!container) return;
    const allTitles = await loadAllTitles();
    const ownedIds = await loadUserOwnedTitles(state.currentUser.id);
    let html = '';
    for (let title of allTitles) {
        const isSpecial = (title.id === 10001 || title.id === 10002);
        if (isSpecial && !ownedIds.includes(title.id)) continue;
        const owned = ownedIds.includes(title.id);
        const isEquipped = (state.userProfile?.equipped_title_id === title.id);
        let nameColor = '';
        let extraIcon = '';
        if (title.is_limited) {
            if (title.name.includes('创世神')) nameColor = '#f39c12';
            else if (title.name.includes('管理神')) nameColor = '#60a5fa';
            extraIcon = '✨ ';
        }
        if (isSpecial) nameColor = '#FF69B4';
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
        btn.addEventListener('click', async () => {
            const tid = parseInt(btn.dataset.id);
            await window.equipTitle(tid);
            closeModal('titlesModal');
        });
    });
    openModal('titlesModal');
}

// ===== 奖励预览 =====
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
    let footerHtml = `<div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px; text-align:center; font-size:0.95rem; background:rgba(0,0,0,0.2); border-radius:8px; padding:12px;"><div style="color:var(--text-secondary); margin-bottom:4px;">您已连续签到 <strong style="color:#facc15; font-size:1.1rem;">${currentStreak.toLocaleString()}</strong> 天</div><div style="color:var(--text-highlight);">明天的奖励：🍬${tomorrowReward.candy.toLocaleString()} ${tomorrowReward.rainbow > 0 ? `🌈${tomorrowReward.rainbow.toLocaleString()} ` : ''}⚡${tomorrowReward.active.toLocaleString()}</div></div>`;
    const container = document.getElementById('rewardInfoContent');
    if (container) { container.innerHTML = html + footerHtml; openModal('rewardInfoModal'); }
}

// ============================================================
// ★★★ 成就系统 UI（含稀有度 + 隐藏模式 + 成就积分） ★★★
// ============================================================
const ACH_CATEGORY_NAME = {
    checkin:    '📅 签到成就',
    chest:      '📦 宝箱成就',
    wealth:     '💰 财富成就',
    collection: '🎨 收藏成就',
    special:    '✨ 特殊成就',
    general:    '🏆 综合成就'
};

const ACH_RARITY = {
    bronze:  { name: '铜',   color: '#cd7f32', bg: 'rgba(205,127,50,0.15)' },
    silver:  { name: '银',   color: '#c0c0c0', bg: 'rgba(192,192,192,0.15)' },
    gold:    { name: '金',   color: '#ffd700', bg: 'rgba(255,215,0,0.15)' },
    diamond: { name: '钻',   color: '#67e8f9', bg: 'rgba(103,232,249,0.15)' },
    legend:  { name: '传说', color: '#f472b6', bg: 'rgba(244,114,182,0.15)' }
};

export async function renderAchievementsModal() {
    const container = document.getElementById('achievementsContent');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:30px;opacity:0.6;">⏳ 加载成就中...</div>';
    openModal('achievementsModal');

    try {
        const list = await getAchievementsStatus();

        const groups = {};
        let visibleTotal = 0, unlockedTotal = 0;

        for (const a of list) {
            // ★ 完全隐身的隐藏成就：未解锁时直接跳过
            if (a.is_hidden && !a.unlocked_at && a.hidden_style === 'invisible') {
                continue;
            }
            // ★ 占位型隐藏成就：显示 ❓ 神秘成就
            if (a.is_hidden && !a.unlocked_at) {
                const g = groups[a.category] || (groups[a.category] = []);
                g.push({ ...a, _hiddenPlaceholder: true });
                visibleTotal++;
                continue;
            }
            const g = groups[a.category] || (groups[a.category] = []);
            g.push(a);
            visibleTotal++;
            if (a.unlocked_at) unlockedTotal++;
        }

        const ap = state.userStats?.achievement_points || 0;

        let html = `
            <div class="ach-summary">
                <div class="ach-summary-num">
                    <span style="color:#facc15;font-weight:bold;font-size:1.4rem;">${unlockedTotal}</span>
                    <span style="opacity:0.6;"> / ${visibleTotal}</span>
                </div>
                <div class="ach-summary-label">已解锁成就</div>
                <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(250,204,21,0.15); font-size:0.95rem;">
                    🏅 成就积分：<strong style="color:#facc15;">${ap.toLocaleString()}</strong>
                </div>
            </div>
        `;

        if (visibleTotal === 0) {
            html += '<div style="text-align:center;padding:30px;opacity:0.5;">暂无成就</div>';
            container.innerHTML = html;
            return;
        }

        const order = ['checkin', 'chest', 'wealth', 'collection', 'special', 'general'];
        for (const key of order) {
            const arr = groups[key];
            if (!arr || !arr.length) continue;
            html += `<div class="ach-category"><div class="ach-cat-title">${ACH_CATEGORY_NAME[key] || key}</div><div class="ach-grid">`;
            for (const a of arr) {
                if (a._hiddenPlaceholder) {
                    html += `
                        <div class="ach-item locked hidden-ach">
                            <div class="ach-icon">❓</div>
                            <div class="ach-info">
                                <div class="ach-name">神秘成就</div>
                                <div class="ach-desc">继续探索以解锁</div>
                            </div>
                        </div>`;
                    continue;
                }
                const unlocked = !!a.unlocked_at;
                const progress = Math.min(Number(a.progress) || 0, Number(a.condition_value) || 0);
                const pct = a.condition_value > 0 ? Math.floor((progress / a.condition_value) * 100) : 0;
                const rarityInfo = ACH_RARITY[a.rarity] || ACH_RARITY.bronze;

                const rewards = [];
                if (a.reward_candy   > 0) rewards.push(`🍬${Number(a.reward_candy).toLocaleString()}`);
                if (a.reward_rainbow > 0) rewards.push(`🌈${Number(a.reward_rainbow).toLocaleString()}`);
                if (a.reward_syrup   > 0) rewards.push(`🌌${Number(a.reward_syrup).toLocaleString()}`);
                if (a.reward_active  > 0) rewards.push(`⚡${Number(a.reward_active).toLocaleString()}`);

                html += `
                    <div class="ach-item ${unlocked ? 'unlocked' : 'locked'}" style="border-color: ${unlocked ? rarityInfo.color + '66' : ''};">
                        <div class="ach-icon">${a.icon || '🏆'}</div>
                        <div class="ach-info">
                            <div class="ach-name">
                                ${escapeHtml(a.name)}
                                <span style="font-size:0.7rem; padding:1px 6px; border-radius:8px; margin-left:6px; background:${rarityInfo.bg}; color:${rarityInfo.color}; border:1px solid ${rarityInfo.color}44;">${rarityInfo.name}</span>
                            </div>
                            <div class="ach-desc">${escapeHtml(a.description || '')}</div>
                            ${!unlocked && a.condition_value > 1 ? `
                                <div class="ach-progress-bar">
                                    <div class="ach-progress-fill" style="width:${pct}%; background:linear-gradient(90deg, ${rarityInfo.color}88, ${rarityInfo.color});"></div>
                                </div>
                                <div class="ach-progress-text">${progress.toLocaleString()} / ${Number(a.condition_value).toLocaleString()}</div>
                            ` : ''}
                            ${rewards.length ? `<div class="ach-rewards">奖励：${rewards.join(' ')}</div>` : ''}
                        </div>
                        ${unlocked ? `<div class="ach-badge" style="background:${rarityInfo.color};">✓</div>` : ''}
                    </div>
                `;
            }
            html += `</div></div>`;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error('加载成就失败', e);
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;">加载失败：${escapeHtml(e.message || '未知错误')}</div>`;
    }
}

export function showAchievementUnlockModal(achievements, rewards) {
    if (!achievements || !achievements.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.zIndex = '10000';

    const rewardLines = [];
    if (rewards.candy   > 0) rewardLines.push(`🍬 +${Number(rewards.candy).toLocaleString()} 糖果碎`);
    if (rewards.rainbow > 0) rewardLines.push(`🌈 +${Number(rewards.rainbow).toLocaleString()} 超级棒糖`);
    if (rewards.syrup   > 0) rewardLines.push(`🌌 +${Number(rewards.syrup).toLocaleString()} 星河糖浆`);
    if (rewards.active  > 0) rewardLines.push(`⚡ +${Number(rewards.active).toLocaleString()} 活跃度`);

    overlay.innerHTML = `
        <div class="modal" style="max-width:380px;text-align:center;border:2px solid #facc15;box-shadow:0 0 40px rgba(250,204,21,0.4);">
            <div style="padding:24px 16px 16px;">
                <div style="font-size:2.5rem;margin-bottom:6px;">🎉</div>
                <div style="font-size:1.2rem;font-weight:bold;color:#facc15;margin-bottom:16px;">成就解锁！</div>
                <div style="max-height:260px;overflow-y:auto;text-align:left;padding:0 8px;margin-bottom:16px;">
                    ${achievements.map(a => {
                        const rarityInfo = ACH_RARITY[a.rarity] || ACH_RARITY.bronze;
                        return `
                        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <div style="font-size:1.8rem;">${a.icon || '🏆'}</div>
                            <div>
                                <div style="font-weight:bold;">
                                    ${escapeHtml(a.name)}
                                    <span style="font-size:0.65rem; padding:1px 5px; border-radius:7px; margin-left:4px; background:${rarityInfo.bg}; color:${rarityInfo.color}; border:1px solid ${rarityInfo.color}44;">${rarityInfo.name}</span>
                                </div>
                                <div style="font-size:0.8rem;opacity:0.7;">${escapeHtml(a.description || '')}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                ${rewardLines.length ? `
                    <div style="background:rgba(250,204,21,0.12);border-radius:10px;padding:10px;margin-bottom:14px;">
                        <div style="font-size:0.85rem;opacity:0.7;margin-bottom:6px;">成就奖励</div>
                        ${rewardLines.map(l => `<div style="font-size:0.95rem;padding:2px 0;">${l}</div>`).join('')}
                    </div>
                ` : ''}
                <button class="btn-primary" id="closeAchUnlockBtn" style="width:100%;">太棒了！</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('closeAchUnlockBtn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ============================================================
// ★★★ 通知系统 UI ★★★
// ============================================================
const NOTIF_TYPE_META = {
    achievement: { color: '#facc15', label: '成就' },
    chest:       { color: '#f59e0b', label: '宝箱' },
    redeem:      { color: '#ec4899', label: '兑换码' },
    checkin:     { color: '#3ecf8e', label: '签到' },
    system:      { color: '#60a5fa', label: '系统' }
};

function formatRelativeTime(iso) {
    if (!iso) return '';
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function renderNotificationsModal() {
    const container = document.getElementById('notificationsContent');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:30px;opacity:0.6;">⏳ 加载中...</div>';
    openModal('notificationsModal');

    try {
        const { notifications, unread_count } = await getMyNotifications();

        let html = '';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 4px 12px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:8px;">
                <div style="font-size:0.85rem; color:var(--text-secondary);">
                    ${unread_count > 0 ? `你还有 <strong style="color:#f87171;">${unread_count}</strong> 条未读` : '全部已读'}
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="notifMarkAllReadBtn" style="background:none; border:1px solid rgba(96,165,250,0.4); color:#60a5fa; padding:3px 10px; border-radius:12px; font-size:0.75rem; cursor:pointer; ${unread_count === 0 ? 'opacity:0.4;cursor:not-allowed;' : ''}" ${unread_count === 0 ? 'disabled' : ''}>全部已读</button>
                    <button id="notifClearAllBtn" style="background:none; border:1px solid rgba(248,113,113,0.4); color:#f87171; padding:3px 10px; border-radius:12px; font-size:0.75rem; cursor:pointer;">清空</button>
                </div>
            </div>
        `;

        if (!notifications || notifications.length === 0) {
            html += '<div style="text-align:center;padding:50px 20px;color:var(--text-secondary);">📭 暂无通知</div>';
            container.innerHTML = html;
            return;
        }

        html += '<div style="display:flex; flex-direction:column; gap:6px;">';

        for (const n of notifications) {
            const meta = NOTIF_TYPE_META[n.type] || NOTIF_TYPE_META.system;
            const unread = !n.is_read;
            html += `
                <div class="notif-item" data-id="${n.id}" style="display:flex; gap:10px; padding:10px 12px; border-radius:10px; background:${unread ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${unread ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)'}; cursor:pointer; transition:all 0.2s; position:relative;">
                    <div style="font-size:1.6rem; flex-shrink:0; width:36px; text-align:center;">${n.icon || '🔔'}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                            <span style="font-weight:${unread ? 'bold' : '500'}; font-size:0.92rem; color:${unread ? '#fff' : 'rgba(255,255,255,0.8)'};">${escapeHtml(n.title)}</span>
                            ${unread ? '<span style="width:7px; height:7px; border-radius:50%; background:#60a5fa; flex-shrink:0;"></span>' : ''}
                        </div>
                        ${n.body ? `<div style="font-size:0.78rem; color:rgba(255,255,255,0.6); line-height:1.35; margin-bottom:4px;">${escapeHtml(n.body)}</div>` : ''}
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:rgba(255,255,255,0.4);">
                            <span style="color:${meta.color}; opacity:0.8;">${meta.label}</span>
                            <span>${formatRelativeTime(n.created_at)}</span>
                        </div>
                    </div>
                    <button class="notif-del-btn" data-id="${n.id}" style="position:absolute; top:6px; right:6px; background:none; border:none; color:rgba(255,255,255,0.25); cursor:pointer; font-size:1rem; padding:2px 6px;">&times;</button>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                if (e.target.closest('.notif-del-btn')) return;
                const id = parseInt(item.dataset.id);
                const n = notifications.find(x => x.id === id);
                if (!n) return;

                if (!n.is_read) {
                    try {
                        await markNotificationRead(id);
                        await updateNotificationBadge();
                        item.style.background = 'rgba(255,255,255,0.02)';
                        item.style.borderColor = 'rgba(255,255,255,0.05)';
                    } catch (err) { console.warn('标记已读失败', err); }
                }

                if (n.link === 'achievements') {
                    closeModal('notificationsModal');
                    setTimeout(() => renderAchievementsModal(), 200);
                } else if (n.link === 'backpack') {
                    closeModal('notificationsModal');
                    setTimeout(() => renderBackpack(), 200);
                } else if (n.link === 'checkin' || n.link === 'redeem') {
                    closeModal('notificationsModal');
                }
            });
        });

        container.querySelectorAll('.notif-del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                try {
                    await deleteNotification(id);
                    btn.closest('.notif-item')?.remove();
                    await updateNotificationBadge();
                } catch (err) { console.warn('删除失败', err); }
            });
        });

        document.getElementById('notifMarkAllReadBtn')?.addEventListener('click', async () => {
            try {
                await markAllNotificationsRead();
                await renderNotificationsModal();
                await updateNotificationBadge();
                showNotification('✅ 已全部标为已读', 'success');
            } catch (err) { showNotification('操作失败', 'error'); }
        });

        document.getElementById('notifClearAllBtn')?.addEventListener('click', async () => {
            if (!confirm('确定清空所有通知吗？此操作不可恢复。')) return;
            try {
                await clearAllNotifications();
                await renderNotificationsModal();
                await updateNotificationBadge();
                showNotification('🗑️ 已清空通知', 'success');
            } catch (err) { showNotification('操作失败', 'error'); }
        });

    } catch (e) {
        console.error('加载通知失败', e);
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;">加载失败：${escapeHtml(e.message || '未知错误')}</div>`;
    }
}

export async function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    try {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('get_unread_notification_count');
        const count = (!error && typeof data === 'number') ? data : 0;
        if (count > 0) {
            badge.style.display = 'flex';
            badge.textContent = count > 99 ? '99+' : String(count);
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        badge.style.display = 'none';
    }
}

// 导出全局更新显示函数
window.updateChestDisplay = function() {
    const el = document.getElementById('chestDisplay');
    if (el) {
        el.textContent = `🎁 宝箱：${(state.userStats?.chest_count || 0).toLocaleString()}`;
    }
};