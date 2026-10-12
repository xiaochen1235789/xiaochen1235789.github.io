// ========== 工具函数 ==========
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

export function getLocalDateString(date = new Date()) {
    return date.toLocaleDateString('sv-SE');
}

export function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '--';
}

// ===== 通知系统 =====
let notificationTimeout = null;

export function showNotification(msg, type = 'info', duration = 6000) {
    let n = document.getElementById('notification');
    if (!n) {
        n = document.createElement('div');
        n.id = 'notification';
        document.body.appendChild(n);
    }

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    n.className = 'notification';
    n.textContent = msg;
    void n.offsetWidth;
    n.classList.add(type, 'show');

    notificationTimeout = setTimeout(() => {
        if (n) n.classList.remove('show');
        notificationTimeout = null;
    }, duration);
}

export function showSyncNotice() {
    const sn = document.getElementById('syncNotice');
    if (sn) {
        sn.classList.add('show');
        setTimeout(() => sn.classList.remove('show'), 2000);
    }
}

// ===== 模态框控制 =====
export function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (m.classList.contains('show')) return;
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
    document.body.style.overflow = '';
}

// ===== 缓存管理 =====
// ★ 缓存必须绑定 userId，避免切换账号时读到上一个账号的数据
const CACHE_KEY = 'userProfileCache';
const CACHE_TTL = 3600000; // 1 小时

/**
 * 读取用户资料缓存
 * @param {string} currentUserId 当前登录用户 ID（必须传入！）
 * @returns {object|null}
 */
export function getCachedProfile(currentUserId) {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { data, timestamp, userId } = JSON.parse(raw);
        if (!timestamp || (Date.now() - timestamp) >= CACHE_TTL) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        // ★ 缓存必须和当前登录账号一致，否则视为无效
        if (!currentUserId || userId !== currentUserId) {
            return null;
        }
        return data;
    } catch (e) {
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
}

/**
 * 写入用户资料缓存
 * @param {object} data 要缓存的数据
 * @param {string} userId 该数据所属的用户 ID（必须传入！）
 */
export function setCachedProfile(data, userId) {
    const uid = userId || data?.id || data?.user_id;
    if (!uid) return; // 没 userId 绝不写缓存，避免污染下一个账号
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        userId: uid
    }));
}

export function clearProfileCache() {
    localStorage.removeItem(CACHE_KEY);
}