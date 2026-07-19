// ========== 主入口 ==========
import { CONFIG, getRoleDisplay } from './config.js';
import {
    showNotification, openModal, closeModal,
    getLocalDateString, clearProfileCache, setCachedProfile,
    safeSetText
} from './utils.js';
import {
    initSupabase, getSupabase, fetchUserFullData,
    updateUserProfile, updateUserStats, getCheckinConfig,
    loadAutoSignCardStatus, loadAllTitles, loadUserOwnedTitles,
    grantTitle, loadUserFrames
} from './api.js';
import {
    getFrameById, purchaseFrame, equipFrame, applyFrameClassByFrameId,
    initFrameForUser
} from './frame-system.js';
import {
    setAppState, renderProfile, updateAvatarDisplay,
    updateCheckinButtonState, updateActivePointsDisplay,
    updateShopBalanceDisplay, renderShop, renderBackpack,
    renderTitlesModal, openBackpackItemDetail, openRewardInfoModal
} from './ui-renderer.js';

// ========== 全局状态 ==========
let currentUser = null;
let userProfile = null;
let userStats = null;
let hasAutoSignCard = false;
let autoSignAttempted = false;
let isProcessing = false;

// 暴露给 window
window.currentUser = currentUser;
window.userStats = userStats;
window.userProfile = userProfile;
window.isProcessing = isProcessing;

// ★ 统一状态更新函数
function updateAppState() {
    setAppState({ currentUser, userProfile, userStats });
    window.currentUser = currentUser;
    window.userProfile = userProfile;
    window.userStats = userStats;
    clearProfileCache();
    setCachedProfile({ ...userProfile, ...userStats });
}

// ========== 导航栏 ==========
function updateNavbar() {
    const navDiv = document.getElementById('userNavSection');
    if (!navDiv) return;
    if (!currentUser) { navDiv.innerHTML = '<a href="login-real.html">登录</a>'; return; }
    const username = userProfile?.username || currentUser?.email?.split('@')[0] || '用户';
    const roleInfo = getRoleDisplay(userProfile?.role);
    const avatarUrl = userProfile?.avatar_url || localStorage.getItem('userAvatar');
    const avatarHtml = avatarUrl ?
        `<img src="${avatarUrl}" style="width:32px;height:32px;border-radius:50%;">` :
        `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3ecf8e,#8a4baf);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;">${username.charAt(0).toUpperCase()}</div>`;
    navDiv.innerHTML =
        `<div style="display:flex;align-items:center;gap:8px;">${avatarHtml}<span style="color:${roleInfo.color};">${username} (${roleInfo.name})</span><button id="logoutBtn" style="background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.3);padding:4px 12px;border-radius:20px;cursor:pointer;"><i class="fas fa-sign-out-alt"></i> 退出</button></div>`;
    document.getElementById('logoutBtn')?.addEventListener('click', () => openModal('logoutConfirmModal'));

    const adminLink = document.getElementById('adminLink');
    if (adminLink && currentUser && (userProfile?.role === 'owner' || userProfile?.role === 'admin')) {
        adminLink.style.display = 'inline-block';
    } else if (adminLink) {
        adminLink.style.display = 'none';
    }
}

// ========== 称号刷新 ==========
async function refreshTitles() {
    const allTitles = await loadAllTitles();
    let ownedIds = await loadUserOwnedTitles(currentUser.id);

    // 授予管理员限定称号
    const role = userProfile?.role;
    const limitedTitles = allTitles.filter(t => t.is_limited);
    let toGrant = [];
    if (role === 'owner') {
        const creator = limitedTitles.find(t => t.name.includes('创世神'));
        const manager = limitedTitles.find(t => t.name.includes('管理神'));
        if (creator && !ownedIds.includes(creator.id)) toGrant.push(creator.id);
        if (manager && !ownedIds.includes(manager.id)) toGrant.push(manager.id);
    } else if (role === 'admin') {
        const manager = limitedTitles.find(t => t.name.includes('管理神'));
        if (manager && !ownedIds.includes(manager.id)) toGrant.push(manager.id);
    }
    for (let tid of toGrant) {
        await grantTitle(currentUser.id, tid);
        ownedIds.push(tid);
    }
    if (toGrant.length > 0) showNotification('✨ 获得管理员限定称号', 'success');

    // 检查普通称号条件
    let newGranted = [];
    for (let title of allTitles) {
        if (title.is_limited) continue;
        if (ownedIds.includes(title.id)) continue;
        let meets = true;
        if (title.required_active_points > 0 && (userStats?.active_points || 0) < title.required_active_points) meets = false;
        if (title.required_streak > 0 && (userStats?.checkin_streak || 0) < title.required_streak) meets = false;
        if (title.required_candy > 0 && (userStats?.candy_crumbles || 0) < title.required_candy) meets = false;
        if (title.required_rainbow > 0 && (userStats?.rainbow_lollipops || 0) < title.required_rainbow) meets = false;
        if (meets) {
            await grantTitle(currentUser.id, title.id);
            newGranted.push(title.name);
            ownedIds.push(title.id);
        }
    }
    if (newGranted.length > 0) showNotification(`🎉 获得新称号：${newGranted.join(', ')}`, 'success');

    // 更新界面称号显示
    let equippedTitleObj = null;
    if (userProfile?.equipped_title_id) {
        equippedTitleObj = allTitles.find(t => t.id === userProfile.equipped_title_id);
    }
    const container = document.getElementById('userTitleRow');
    if (container) {
        if (equippedTitleObj) {
            let color = '#facc15';
            if (equippedTitleObj.name.includes('创世神')) color = '#f39c12';
            else if (equippedTitleObj.name.includes('管理神')) color = '#60a5fa';
            container.innerHTML =
                `<div class="title-badge" style="border-left: 3px solid ${color};"><i class="fas fa-medal" style="color:${color};"></i> <span id="equippedTitleName" style="color:${color};">${equippedTitleObj.name}</span> <button id="unequipTitleBtn" style="background:none;border:none;color:#aaa;cursor:pointer;margin-left:6px;">[卸下]</button></div>`;
            document.getElementById('unequipTitleBtn')?.addEventListener('click', unequipTitle);
        } else {
            container.innerHTML =
                `<div class="title-badge"><i class="fas fa-medal"></i> <span id="equippedTitleName">无称号</span> <button id="openTitlesFromBadgeBtn" style="background:none;border:none;color:#facc15;cursor:pointer;margin-left:6px;">[选择]</button></div>`;
            document.getElementById('openTitlesFromBadgeBtn')?.addEventListener('click', () => renderTitlesModal());
        }
    }
}

// ========== 装备/卸下称号 ==========
async function equipTitle(titleId) {
    const sb = getSupabase();
    const { error } = await sb.from('user_profiles').update({ equipped_title_id: titleId }).eq('id', currentUser.id);
    if (error) { showNotification('装备失败', 'error'); return; }
    userProfile.equipped_title_id = titleId;
    updateAppState();
    await refreshTitles();
    showNotification(`已装备称号`, 'success');
}
window.equipTitle = equipTitle;

async function unequipTitle() {
    const sb = getSupabase();
    const { error } = await sb.from('user_profiles').update({ equipped_title_id: null }).eq('id', currentUser.id);
    if (error) { showNotification('卸下失败', 'error'); return; }
    userProfile.equipped_title_id = null;
    updateAppState();
    await refreshTitles();
    showNotification('已卸下称号', 'success');
}

// ========== 签到执行 ==========
async function executeCheckin(autoTriggered = false) {
    const today = getLocalDateString();
    if (userStats?.last_checkin_date === today) {
        if (!autoTriggered) showNotification('今日已签到', 'warning');
        updateCheckinButtonState();
        return false;
    }
    let newStreak = 1;
    const last = userStats?.last_checkin_date;
    if (last) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);
        if (last === yesterdayStr) newStreak = (userStats.checkin_streak || 0) + 1;
    }
    const rewards = await getCheckinConfig(newStreak);
    const newCandy = (userStats?.candy_crumbles || 0) + rewards.candy;
    const newRainbow = (userStats?.rainbow_lollipops || 0) + rewards.rainbow;
    const newActive = (userStats?.active_points || 0) + rewards.active;

    const sb = getSupabase();
    const { error: updateError } = await sb.from('user_stats').update({
        candy_crumbles: newCandy,
        rainbow_lollipops: newRainbow,
        active_points: newActive,
        last_checkin_date: today,
        checkin_streak: newStreak
    }).eq('user_id', currentUser.id);
    if (updateError) { showNotification('签到失败', 'error'); return false; }

    userStats = { ...(userStats || {}), candy_crumbles: newCandy, rainbow_lollipops: newRainbow, active_points: newActive, last_checkin_date: today, checkin_streak: newStreak };
    updateAppState();  // ★ 同步状态
    updateActivePointsDisplay();
    updateShopBalanceDisplay();
    document.getElementById('streakDays').innerText = newStreak.toLocaleString();
    updateCheckinButtonState();

    showNotification(autoTriggered ? `✨ 自动签到卡已为您签到 +${rewards.candy.toLocaleString()}🍬` : `签到 +${rewards.candy.toLocaleString()}🍬`, 'success');
    return true;
}

async function performCheckin() {
    if (isProcessing) return;
    isProcessing = true;
    await executeCheckin(false);
    isProcessing = false;
}

async function tryAutoSign() {
    if (autoSignAttempted) return;
    autoSignAttempted = true;
    const today = getLocalDateString();
    if (hasAutoSignCard && userStats?.last_checkin_date !== today) {
        showNotification('🃏 检测到自动签到卡，正在自动签到...', 'info');
        await executeCheckin(true);
    }
}

// ========== 兑换功能 ==========
async function doLowExchange(direction) {
    const amount = parseInt(document.getElementById('lowExchangeAmount').value);
    if (!amount || amount < 1) return showNotification('请输入正确数量', 'error');
    if (isProcessing) return;
    const sb = getSupabase();
    const { data, error } = await sb.rpc('exchange_low_level', { p_user_id: currentUser.id, p_direction: direction, p_amount: amount });
    if (error) return showNotification('兑换失败: ' + error.message, 'error');
    if (!data) return showNotification('余额不足，无法兑换！', 'error');
    showNotification('✅ 双向兑换成功！', 'success');
    await refreshUserStats();
}
window.doLowExchange = doLowExchange;

async function doSyrupExchange(direction) {
    const amount = parseInt(document.getElementById('syrupExchangeAmount').value);
    if (!amount || amount < 1) return showNotification('请输入正确数量', 'error');
    if (isProcessing) return;
    const sb = getSupabase();
    const { data, error } = await sb.rpc('exchange_syrup_down', { p_user_id: currentUser.id, p_target: direction, p_amount: amount });
    if (error) return showNotification('兑换失败: ' + error.message, 'error');
    if (!data) return showNotification('🌌 梦幻星河糖浆不足！', 'error');
    showNotification('✨ 高阶货币向下兑换成功！', 'success');
    await refreshUserStats();
}
window.doSyrupExchange = doSyrupExchange;

async function refreshUserStats() {
    const sb = getSupabase();
    const [profileRes, statsRes] = await Promise.all([
        sb.from('user_profiles').select('*').eq('id', currentUser.id).maybeSingle(),
        sb.from('user_stats').select('*').eq('user_id', currentUser.id).maybeSingle()
    ]);
    if (!profileRes.error && profileRes.data) {
        userProfile = { ...(userProfile || {}), ...profileRes.data };
    }
    if (!statsRes.error && statsRes.data) {
        userStats = { ...(userStats || {}), ...statsRes.data };
        updateAppState();
        updateShopBalanceDisplay();
        updateActivePointsDisplay();
    }
}

// ========== 用户信息编辑函数 ==========
window.openUsernameModal = function() {
    document.getElementById('newUsername').value = userProfile?.username || '';
    openModal('usernameModal');
};
window.openBioModal = function() {
    document.getElementById('newBio').value = userProfile?.bio || '';
    openModal('bioModal');
};
window.openPasswordModal = function() {
    openModal('passwordModal');
};
window.openDeleteAccountModal = function() {
    document.getElementById('confirmEmail').value = currentUser?.email || '';
    openModal('deleteAccountModal');
};
window.openBackpack = renderBackpack;
window.openBackpackItemDetail = openBackpackItemDetail;
window.openTitlesModal = renderTitlesModal;
window.openRewardInfoModal = openRewardInfoModal;

// ========== 各种保存/更新操作 ==========
async function updateUsername() {
    const newName = document.getElementById('newUsername').value.trim();
    if (!newName || newName.length < 2 || newName.length > 20) return showNotification('用户名2-20字符', 'error');
    try {
        await updateUserProfile(currentUser.id, { username: newName });
        await getSupabase().auth.updateUser({ data: { username: newName } });
        userProfile.username = newName;
        updateAppState();
        const roleInfo = getRoleDisplay(userProfile.role);
        const usernameSpan = document.getElementById('displayUsername');
        if (usernameSpan) usernameSpan.innerHTML = `${newName} <span style="font-size:0.8rem;color:${roleInfo.color};">(${roleInfo.name})</span>`;
        updateNavbar();
        closeModal('usernameModal');
        showNotification('用户名已更新', 'success');
    } catch (err) { showNotification('更新失败: ' + err.message, 'error'); }
}

async function updateBio() {
    const newBio = document.getElementById('newBio').value.trim() || '';
    try {
        await updateUserProfile(currentUser.id, { bio: newBio });
        userProfile.bio = newBio;
        updateAppState();
        safeSetText('userBio', newBio);
        closeModal('bioModal');
        showNotification('简介已更新', 'success');
    } catch (err) { showNotification('更新失败: ' + err.message, 'error'); }
}

async function updatePassword() {
    const cur = document.getElementById('currentPassword').value;
    const np = document.getElementById('newPassword').value;
    const cp = document.getElementById('confirmPassword').value;
    if (!cur || !np || !cp) return showNotification('请填写完整', 'error');
    if (np.length < 6) return showNotification('密码至少6位', 'error');
    if (np !== cp) return showNotification('两次密码不一致', 'error');
    const sb = getSupabase();
    const { error: signErr } = await sb.auth.signInWithPassword({ email: currentUser.email, password: cur });
    if (signErr) return showNotification('当前密码错误', 'error');
    const { error } = await sb.auth.updateUser({ password: np });
    if (error) showNotification('修改失败: ' + error.message, 'error');
    else {
        showNotification('密码已更新，请重新登录', 'success');
        setTimeout(() => { sb.auth.signOut(); localStorage.clear(); window.location.href = 'login-real.html'; }, 1500);
    }
    closeModal('passwordModal');
}

async function deleteAccount() {
    const confirmEmail = document.getElementById('confirmEmail').value;
    if (confirmEmail !== currentUser.email) return showNotification('邮箱不匹配', 'error');
    showNotification('账号删除需联系管理员', 'warning');
    closeModal('deleteAccountModal');
}

async function performLogout() {
    closeModal('logoutConfirmModal');
    await getSupabase().auth.signOut();
    localStorage.clear();
    window.location.href = 'index.html';
}

// ========== 加载用户资料 ==========
async function loadUserProfile() {
    const sb = initSupabase();
    let session = null;
    let attempts = 0;
    while (attempts < 5) {
        const { data, error } = await sb.auth.getSession();
        if (!error && data.session) {
            session = data.session;
            break;
        }
        attempts++;
        await new Promise(r => setTimeout(r, 300));
    }
    if (!session || !session.user) {
        window.location.href = `login-real.html?redirect=${encodeURIComponent(window.location.href)}`;
        return;
    }
    currentUser = session.user;
    window.currentUser = currentUser;

    let fullData = getCachedProfile();
    if (!fullData) {
        fullData = await fetchUserFullData(currentUser.id);
        setCachedProfile(fullData);
    }
    userProfile = fullData;
    userStats = fullData;
    updateAppState();  // ★ 初次加载同步

    // 渲染界面
    await renderProfile();
    await initFrameForUser(currentUser.id);

    // 更新最后登录
    await updateUserStats(currentUser.id, { last_login: new Date().toISOString() });
    safeSetText('lastLogin', new Date().toLocaleString());

    // 自动签到
    hasAutoSignCard = await loadAutoSignCardStatus(currentUser.id);
    await tryAutoSign();

    // 刷新称号
    await refreshTitles();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';
}

// ========== 事件绑定 ==========
function bindEvents() {
    document.getElementById('saveUsername')?.addEventListener('click', updateUsername);
    document.getElementById('saveBio')?.addEventListener('click', updateBio);
    document.getElementById('savePassword')?.addEventListener('click', updatePassword);
    document.getElementById('confirmDeleteAccount')?.addEventListener('click', deleteAccount);

    document.getElementById('confirmCropBtn')?.addEventListener('click', confirmCropAndUpload);
    document.getElementById('cancelCropBtn')?.addEventListener('click', cancelCrop);
    document.getElementById('closeCropModalBtn')?.addEventListener('click', cancelCrop);

    document.getElementById('openShopBtn')?.addEventListener('click', async () => {
        if (isProcessing) return;
        await renderShop();
        openModal('shopModal');
    });
    document.getElementById('openBackpackBtn')?.addEventListener('click', renderBackpack);
    document.getElementById('openTitlesBtn')?.addEventListener('click', renderTitlesModal);
    document.getElementById('openHelpBtn')?.addEventListener('click', () => openModal('helpModal'));

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mid = btn.getAttribute('data-modal');
            if (mid) closeModal(mid);
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function (e) {
            if (e.target === this) closeModal(this.id);
        });
    });

    document.getElementById('checkinBtn')?.addEventListener('click', performCheckin);

    window.addEventListener('scroll', () => {
        const btn = document.querySelector('.back-to-top');
        if (btn) btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });

    attachLongPressToAvatar();
}

// ========== 头像上传相关 ==========
let cropper = null;
let longPressTimer = null;

function attachLongPressToAvatar() {
    const container = document.getElementById('avatarContainer');
    if (!container) return;
    container.addEventListener('touchstart', onAvatarLongPressStart, { passive: false });
    container.addEventListener('touchend', onAvatarLongPressEnd);
    container.addEventListener('touchcancel', onAvatarLongPressEnd);
    container.addEventListener('mousedown', onAvatarLongPressStart);
    container.addEventListener('mouseup', onAvatarLongPressEnd);
    container.addEventListener('mouseleave', onAvatarLongPressEnd);
}

function onAvatarLongPressStart(e) {
    e.preventDefault();
    longPressTimer = setTimeout(() => {
        openModal('avatarConfirmModal');
        longPressTimer = null;
    }, CONFIG.LONG_PRESS_DELAY);
}
function onAvatarLongPressEnd(e) {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

window.confirmChangeAvatar = function() {
    closeModal('avatarConfirmModal');
    openAvatarUpload();
};
window.cancelChangeAvatar = function() {
    closeModal('avatarConfirmModal');
};

function openAvatarUpload() {
    const oldInput = document.getElementById('tempFileInput');
    if (oldInput) oldInput.remove();
    const input = document.createElement('input');
    input.id = 'tempFileInput';
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file && file.size <= 5 * 1024 * 1024) initCropperModal(file);
        else if (file) showNotification('文件过大（最大5MB）', 'error');
        input.remove();
    };
    input.click();
}

function initCropperModal(file) {
    const img = document.getElementById('cropImage');
    const reader = new FileReader();
    reader.onload = function (e) {
        img.src = e.target.result;
        if (cropper) cropper.destroy();
        img.onload = () => {
            cropper = new Cropper(img, { aspectRatio: 1, viewMode: 1, autoCropArea: 0.8 });
            openModal('cropModal');
        };
    };
    reader.readAsDataURL(file);
}

async function confirmCropAndUpload() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: CONFIG.AVATAR_SIZE, height: CONFIG.AVATAR_SIZE });
    canvas.toBlob(async (blob) => {
        if (blob) await uploadCroppedImage(blob);
        closeModal('cropModal');
        if (cropper) { cropper.destroy(); cropper = null; }
        document.getElementById('cropImage').removeAttribute('src');
    }, 'image/png');
}

function cancelCrop() {
    if (cropper) { cropper.destroy(); cropper = null; }
    closeModal('cropModal');
    document.getElementById('cropImage').removeAttribute('src');
}

async function uploadCroppedImage(blob) {
    if (!currentUser || isUploading) return false;
    isUploading = true;
    try {
        const filePath = `${currentUser.id}/avatar.png`;
        const { error: uploadErr } = await getSupabase().storage.from('avatars').upload(filePath, blob, { contentType: 'image/png', upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = getSupabase().storage.from('avatars').getPublicUrl(filePath);
        await updateUserProfile(currentUser.id, { avatar_url: publicUrl });
        userProfile.avatar_url = publicUrl;
        localStorage.setItem('userAvatar', publicUrl);
        updateAvatarDisplay(publicUrl);
        updateAppState();
        updateNavbar();
        showNotification('头像已更新', 'success');
        return true;
    } catch (err) {
        showNotification('上传失败: ' + err.message, 'error');
        return false;
    } finally {
        isUploading = false;
    }
}
let isUploading = false;

// ========== 启动 ==========
export async function initializeApp() {
    try {
        await loadUserProfile();
        bindEvents();
        updateNavbar();
    } catch (err) {
        console.error('初始化失败:', err);
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div style="color: #f87171; padding: 20px; background: rgba(248,113,113,0.1); border-radius: 12px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                    <p style="margin-top: 10px; font-weight: bold;">初始化失败</p>
                    <p style="font-size: 0.9rem; color: #fca5a5;">${escapeHtml(err.message || '未知错误')}</p>
                    <button onclick="location.reload()" style="margin-top: 12px; padding: 6px 20px; background: #3b82f6; color: white; border: none; border-radius: 20px; cursor: pointer;">刷新重试</button>
                </div>
            `;
            loading.style.display = 'block';
        }
        showNotification('初始化失败，请刷新重试', 'error');
    }
}