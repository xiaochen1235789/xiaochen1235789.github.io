// ========== 工具函数 ==========
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// ★ 修复：添加默认参数，调用时不传参则使用当前日期
export function getLocalDateString(date = new Date()) {
    return date.toLocaleDateString('sv-SE');
}

export function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '--';
}

// 通知系统（全局单例）
let notificationTimeout = null;
export function showNotification(msg, type = 'info') {
    let n = document.getElementById('notification');
    if (!n) {
        n = document.createElement('div');
        n.id = 'notification';
        document.body.appendChild(n);
    }
    n.textContent = msg;
    n.className = 'notification ' + type;
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        if (n) n.classList.remove('show');
    }, 3000);
}

export function showSyncNotice() {
    const sn = document.getElementById('syncNotice');
    if (sn) {
        sn.classList.add('show');
        setTimeout(() => sn.classList.remove('show'), 2000);
    }
}

// 模态框控制
export function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('show');
    document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
    document.body.style.overflow = '';
}

// 缓存管理
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