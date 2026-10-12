// ==================== 动态公告系统 ====================
const ANNOUNCEMENT_READ_KEY = 'readAnnouncementIds';

function getReadAnnouncementIds() {
    try {
        return JSON.parse(localStorage.getItem(ANNOUNCEMENT_READ_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function markAnnouncementRead(id) {
    const ids = getReadAnnouncementIds();
    if (!ids.includes(id)) {
        ids.push(id);
        // 只保留最近 50 条，防止无限增长
        if (ids.length > 50) ids.splice(0, ids.length - 50);
        localStorage.setItem(ANNOUNCEMENT_READ_KEY, JSON.stringify(ids));
    }
}

// ==================== 拉取最新公告 ====================
async function fetchLatestAnnouncement() {
    if (!supabaseClient) return null;
    try {
        const { data, error } = await supabaseClient
            .from('site_announcements')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            console.warn('[公告] 拉取失败:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('[公告] 拉取异常:', e);
        return null;
    }
}

// ==================== 渲染弹窗 ====================
function showAnnouncementModal(announcement) {
    if (!announcement) return;
    const existing = document.getElementById('announcementModal');
    if (existing) existing.remove();

    // 按类型配色
    const typeStyles = {
        update: { color: '#60a5fa', icon: 'fa-bullhorn', label: '更新公告' },
        event:  { color: '#f472b6', icon: 'fa-gift',     label: '活动公告' },
        notice: { color: '#facc15', icon: 'fa-info-circle', label: '重要通知' },
        fix:    { color: '#3ecf8e', icon: 'fa-wrench',   label: '问题修复' }
    };
    const style = typeStyles[announcement.type] || typeStyles.update;

    const modal = document.createElement('div');
    modal.id = 'announcementModal';
    modal.className = 'modal-mask active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 560px; text-align: left; padding: 24px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
                        padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <i class="fas ${style.icon}" style="color: ${style.color}; font-size: 1.4rem;"></i>
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; color: ${style.color}; letter-spacing: 1px;
                                font-weight: 600; margin-bottom: 2px;">
                        ${style.label}${announcement.version ? ' · ' + escapeHtml(announcement.version) : ''}
                    </div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-highlight);">
                        ${escapeHtml(announcement.title)}
                    </div>
                </div>
                <button id="announcementCloseBtn" style="background: none; border: none;
                        color: var(--text-secondary); font-size: 1.6rem; cursor: pointer;
                        line-height: 1; padding: 0 6px;" aria-label="关闭">&times;</button>
            </div>
            <div style="max-height: 50vh; overflow-y: auto; line-height: 1.9;
                        color: var(--text-main); font-size: 0.95rem; padding-right: 4px;">
                ${announcement.content}
            </div>
            <div style="text-align: center; margin-top: 20px; padding-top: 16px;
                        border-top: 1px solid var(--border-color);">
                <button id="announcementConfirmBtn"
                        style="background: ${style.color}; color: #121212; border: none;
                               padding: 10px 42px; border-radius: 30px; font-weight: bold;
                               font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">
                    我知道了
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
        markAnnouncementRead(announcement.id);
        modal.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('announcementCloseBtn').onclick = close;
    document.getElementById('announcementConfirmBtn').onclick = close;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// ==================== 入口 ====================
async function checkAnnouncements() {
    const announcement = await fetchLatestAnnouncement();
    if (!announcement) return;

    const readIds = getReadAnnouncementIds();
    if (readIds.includes(announcement.id)) return;   // 已读过，不弹

    // 稍等一点再弹，避免和其他加载抢注意力
    setTimeout(() => showAnnouncementModal(announcement), 800);
}

// 暴露手动打开（侧边菜单可以调用）
window.openAnnouncements = async function() {
    const announcement = await fetchLatestAnnouncement();
    if (!announcement) {
        showNotification('暂无新公告', 'info');
        return;
    }
    showAnnouncementModal(announcement);
};