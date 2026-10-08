// ==================== 自动签到卡功能 ====================
async function loadAutoSignCardStatus() {
    if (!supabaseClient || !currentUser) return null;
    try {
        const { data, error } = await supabaseClient
            .from('user_auto_sign_card')
            .select('owned')
            .eq('user_id', currentUser.id)
            .maybeSingle();
        if (error) return null;
        return data?.owned === true;
    } catch (e) {
        return null;
    }
}

async function updateAutoSignCardStatusUI() {
    const statusElem = document.getElementById('autoSignCardStatus');
    if (!statusElem) return;
    if (!supabaseClient || !currentUser) {
        statusElem.className = 'status-unowned';
        statusElem.textContent = '❌ 未登录';
        return;
    }
    try {
        const owned = await loadAutoSignCardStatus();
        if (owned === null) {
            statusElem.className = 'status-error';
            statusElem.textContent = '❌ 加载失败';
            return;
        }
        hasAutoSignCard = owned;
        if (owned) {
            statusElem.className = 'status-owned';
            statusElem.textContent = '✅ 已拥有';
        } else {
            statusElem.className = 'status-unowned';
            statusElem.textContent = '❌ 未拥有';
        }
    } catch (e) {
        statusElem.className = 'status-error';
        statusElem.textContent = '❌ 加载失败';
    }
}

async function tryAutoSign() {
    if (!currentUser || !userStats || autoSignAttempted) return;
    autoSignAttempted = true;
    const today = getLocalDateString();
    const owned = await loadAutoSignCardStatus();
    if (owned === null) {
        return;
    }
    hasAutoSignCard = owned;
    if (hasAutoSignCard && userStats.last_checkin_date !== today) {
        showNotification('🃏 检测到自动签到卡，正在自动签到...', 'auto-sign');
        await executeCheckin(true);
        await updateAutoSignCardStatusUI();
    }
}