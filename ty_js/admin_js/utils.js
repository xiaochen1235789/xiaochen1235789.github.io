// ========== 工具函数（管理后台专用版） ==========
import { getSupabase } from './auth.js';

// ----- 通用工具 -----
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

// ----- 通知系统 -----
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

// ----- ★★★ 模态框控制（防重复打开） ★★★ -----
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

// ----- 缓存管理 -----
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

// ----- ★★★ 后台专用：操作日志记录 ★★★ -----
export async function logAction(actionType, targetType, targetId, targetName, details) {
    const sb = getSupabase();
    const admin = window.__currentAdmin;
    if (!admin) {
        console.warn('日志记录跳过：未获取到管理员信息');
        return;
    }
    try {
        await sb.from('admin_logs').insert({
            admin_id: admin.id,
            admin_email: admin.email,
            admin_role: admin.role,
            action_type: actionType,
            target_type: targetType,
            target_id: String(targetId || ''),
            target_name: String(targetName || ''),
            details: String(details || '')
        });
    } catch (e) {
        console.warn('日志记录失败', e);
    }
    // 如果当前显示的是日志面板，刷新日志列表（由外部触发）
    if (document.getElementById('logs-panel')?.classList.contains('active-panel')) {
        if (window._refreshLogsCallback) window._refreshLogsCallback();
    }
}