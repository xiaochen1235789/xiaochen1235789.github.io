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

    // ★ 清旧的定时器，避免连续通知时互相打架
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    // ★ 先重置 class，避免上一次的 type 残留（例如 warning 挂在 success 上）
    n.className = 'notification';
    n.textContent = msg;

    // 强制重排，让移除→添加 show 的动作能重启动画
    void n.offsetWidth;

    n.classList.add(type, 'show');

    // ★ 6 秒后自动关闭
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
    // ★ 防重复：如果已经显示，则忽略本次请求
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
export function getCachedProfile() {
    try {
        const raw = localStorage.getItem('userProfileCache');
        if (!raw) return null;
        const { data, timestamp } = JSON.parse(raw);
        if (timestamp && (Date.now() - timestamp) < 3600000) return data;
        return null;
    } catch (e) { return null; }
}

export function setCachedProfile(data) {
    localStorage.setItem('userProfileCache', JSON.stringify({ data, timestamp: Date.now() }));
}

export function clearProfileCache() {
    localStorage.removeItem('userProfileCache');
}