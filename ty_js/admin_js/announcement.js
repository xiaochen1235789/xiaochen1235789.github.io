// ==================== 公告系统（修复版） ====================
// 功能：
//   1. 主页加载时自动弹出「最新未读公告」
//   2. 侧边栏菜单打开「全部公告」列表
//   3. 已读记录存 localStorage，每条只弹一次
//   4. 菜单项显示未读数红点
//
// 修复要点：
//   ✅ ESC 监听器统一追踪 & 清理，不再泄漏
//   ✅ 关闭详情后只更新列表行，不重开列表 modal
//   ✅ body overflow 分层管理
//   ✅ XSS 简单防护（过滤 <script> 和 on*=）
//   ✅ 关闭逻辑幂等，防重复触发
// =========================================================

const ANNOUNCEMENT_READ_KEY = 'readAnnouncementIds';
const ANNOUNCEMENT_CACHE_KEY = 'announcementsCache';
const ANNOUNCEMENT_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

// ==================== 全局 modal 状态（单例） ====================
let currentDetailModal = null;
let currentDetailEscHandler = null;
let currentListModal = null;
let currentListEscHandler = null;

// ==================== 已读记录 ====================
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
        if (ids.length > 100) ids.splice(0, ids.length - 100);
        localStorage.setItem(ANNOUNCEMENT_READ_KEY, JSON.stringify(ids));
    }
    updateAnnouncementBadge();
}

// ==================== 拉取公告列表 ====================
async function fetchAnnouncements(forceRefresh = false) {
    if (!supabaseClient) return [];

    // 缓存命中
    if (!forceRefresh) {
        try {
            const cached = JSON.parse(localStorage.getItem(ANNOUNCEMENT_CACHE_KEY) || 'null');
            if (cached && Date.now() - cached.ts < ANNOUNCEMENT_CACHE_TTL) {
                return cached.list;
            }
        } catch (e) { /* ignore */ }
    }

    try {
        const { data, error } = await supabaseClient
            .from('site_announcements')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.warn('[公告] 拉取失败:', error);
            return [];
        }

        const list = data || [];
        localStorage.setItem(ANNOUNCEMENT_CACHE_KEY, JSON.stringify({
            list, ts: Date.now()
        }));
        return list;
    } catch (e) {
        console.warn('[公告] 拉取异常:', e);
        return [];
    }
}

// ==================== 菜单红点 ====================
async function updateAnnouncementBadge() {
    const badge = document.getElementById('announcementBadge');
    if (!badge) return;
    const list = await fetchAnnouncements();
    const readIds = getReadAnnouncementIds();
    const unreadCount = list.filter(a => !readIds.includes(a.id)).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== 类型样式 ====================
function getAnnouncementStyle(type) {
    const styles = {
        update: { color: '#60a5fa', icon: 'fa-bullhorn',     label: '更新公告', bg: 'rgba(96,165,250,0.12)' },
        event:  { color: '#f472b6', icon: 'fa-gift',         label: '活动公告', bg: 'rgba(244,114,182,0.12)' },
        notice: { color: '#facc15', icon: 'fa-info-circle',  label: '重要通知', bg: 'rgba(250,204,21,0.12)' },
        fix:    { color: '#3ecf8e', icon: 'fa-wrench',       label: '问题修复', bg: 'rgba(62,207,142,0.12)' }
    };
    return styles[type] || styles.update;
}

// ==================== ★ 简单 XSS 防护 ====================
// 只过滤 <script> 和 on*= 事件属性，保留正常的富文本标签
function sanitizeContent(html) {
    if (!html) return '';
    return String(html)
        // 移除 <script>...</script>
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // 移除 on* 事件属性（覆盖 "..." 和 '...' 和裸值三种情况）
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
}

// ==================== 时间格式化 ====================
function formatAnnouncementDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now - d;
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + ' 天前';
    return d.toLocaleDateString('zh-CN');
}

// ==================== 详情弹窗 ====================
function showAnnouncementDetail(announcement, onClose) {
    if (!announcement) return;

    // 单例：如果已有详情弹窗，先清掉（不触发 onClose，避免回调错乱）
    if (currentDetailModal) {
        if (currentDetailEscHandler) {
            document.removeEventListener('keydown', currentDetailEscHandler);
            currentDetailEscHandler = null;
        }
        currentDetailModal.remove();
        currentDetailModal = null;
    }

    const style = getAnnouncementStyle(announcement.type);

    const modal = document.createElement('div');
    modal.id = 'announcementDetailModal';
    modal.className = 'modal-mask active';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 560px; text-align: left; padding: 24px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
                        padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div style="width: 42px; height: 42px; border-radius: 12px;
                            background: ${style.bg}; display: flex; align-items: center;
                            justify-content: center; flex-shrink: 0;">
                    <i class="fas ${style.icon}" style="color: ${style.color}; font-size: 1.2rem;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.72rem; color: ${style.color}; letter-spacing: 1px;
                                font-weight: 600; margin-bottom: 3px;">
                        ${style.label}${announcement.version ? ' · ' + escapeHtml(announcement.version) : ''}
                    </div>
                    <div style="font-size: 1.05rem; font-weight: bold; color: var(--text-highlight);
                                line-height: 1.35;">
                        ${escapeHtml(announcement.title)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                        ${formatAnnouncementDate(announcement.created_at)}
                    </div>
                </div>
                <button id="announcementDetailCloseBtn" style="background: none; border: none;
                        color: var(--text-secondary); font-size: 1.6rem; cursor: pointer;
                        line-height: 1; padding: 0 6px; align-self: flex-start;" aria-label="关闭">&times;</button>
            </div>
            <div style="max-height: 55vh; overflow-y: auto; line-height: 1.9;
                        color: var(--text-main); font-size: 0.95rem; padding-right: 4px;">
                ${sanitizeContent(announcement.content)}
            </div>
            <div style="text-align: center; margin-top: 20px; padding-top: 16px;
                        border-top: 1px solid var(--border-color);">
                <button id="announcementDetailConfirmBtn"
                        style="background: ${style.color}; color: #121212; border: none;
                               padding: 10px 42px; border-radius: 30px; font-weight: bold;
                               font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">
                    我知道了
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    currentDetailModal = modal;

    // ★ 打开详情时锁背景滚动
    document.body.style.overflow = 'hidden';

    // ★ close 幂等：只对当前 modal 生效，且只清理一次
    const close = () => {
        if (currentDetailModal !== modal) return; // 已经被关过了

        markAnnouncementRead(announcement.id); // 内部会刷新 badge

        // 移除 ESC 监听
        if (currentDetailEscHandler) {
            document.removeEventListener('keydown', currentDetailEscHandler);
            currentDetailEscHandler = null;
        }

        modal.classList.remove('active');
        currentDetailModal = null;

        // ★ 只有列表没开的时候才恢复 body 滚动
        if (!currentListModal) {
            document.body.style.overflow = '';
        }

        setTimeout(() => {
            modal.remove();
            if (onClose) onClose();
        }, 200);
    };

    document.getElementById('announcementDetailCloseBtn').onclick = close;
    document.getElementById('announcementDetailConfirmBtn').onclick = close;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // ★ ESC 监听器追踪，close 里统一移除
    currentDetailEscHandler = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', currentDetailEscHandler);
}

// ==================== 列表弹窗（侧边栏入口） ====================
async function openAnnouncementList() {
    // 单例：如果已有列表，先清掉
    if (currentListModal) {
        if (currentListEscHandler) {
            document.removeEventListener('keydown', currentListEscHandler);
            currentListEscHandler = null;
        }
        currentListModal.remove();
        currentListModal = null;
    }

    const modal = document.createElement('div');
    modal.id = 'announcementListModal';
    modal.className = 'modal-mask active';
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 580px; text-align: left; padding: 0;
                    display: flex; flex-direction: column; max-height: 85vh;">
            <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--border-color);
                        display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-bullhorn" style="color: #60a5fa; font-size: 1.3rem;"></i>
                <div style="flex: 1;">
                    <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-highlight);">
                        公告中心
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                        查看所有历史公告
                    </div>
                </div>
                <button id="announcementListCloseBtn" style="background: none; border: none;
                        color: var(--text-secondary); font-size: 1.6rem; cursor: pointer;
                        line-height: 1; padding: 0 6px;" aria-label="关闭">&times;</button>
            </div>
            <div id="announcementListContent" style="flex: 1; overflow-y: auto; padding: 12px 16px;">
                <div style="text-align: center; padding: 40px 0; color: var(--text-secondary);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem;"></i>
                    <p style="margin-top: 12px;">加载中...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    currentListModal = modal;
    document.body.style.overflow = 'hidden';

    // ★ close 幂等
    const close = () => {
        if (currentListModal !== modal) return;

        if (currentListEscHandler) {
            document.removeEventListener('keydown', currentListEscHandler);
            currentListEscHandler = null;
        }
        modal.classList.remove('active');
        currentListModal = null;

        // ★ 详情没开才恢复滚动
        if (!currentDetailModal) {
            document.body.style.overflow = '';
        }

        setTimeout(() => modal.remove(), 200);
    };

    document.getElementById('announcementListCloseBtn').onclick = close;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    currentListEscHandler = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', currentListEscHandler);

    // ==================== 拉取并渲染 ====================
    const list = await fetchAnnouncements(true);
    const container = document.getElementById('announcementListContent');
    if (!container) return; // 可能已被用户关闭

    if (!list.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 3rem; margin-bottom: 12px;">📭</div>
                <div style="font-size: 1rem;">暂无公告</div>
                <div style="font-size: 0.8rem; margin-top: 6px;">有新公告会第一时间通知你~</div>
            </div>
        `;
        return;
    }

    const readIds = getReadAnnouncementIds();
    let html = '';
    for (const a of list) {
        const style = getAnnouncementStyle(a.type);
        const isUnread = !readIds.includes(a.id);
        html += `
            <div class="announcement-list-item" data-id="${a.id}" data-unread="${isUnread ? '1' : '0'}"
                 style="padding: 14px 16px; border-radius: 12px; margin-bottom: 8px;
                        cursor: pointer; transition: all 0.2s;
                        background: ${isUnread ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)'};
                        border: 1px solid ${isUnread ? 'rgba(96,165,250,0.25)' : 'transparent'};">
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                    <div style="width: 36px; height: 36px; border-radius: 10px;
                                background: ${style.bg}; display: flex; align-items: center;
                                justify-content: center; flex-shrink: 0;">
                        <i class="fas ${style.icon}" style="color: ${style.color}; font-size: 1rem;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="font-size: 0.7rem; color: ${style.color};
                                         font-weight: 600; letter-spacing: 0.5px;">
                                ${style.label}${a.version ? ' · ' + escapeHtml(a.version) : ''}
                            </span>
                            <span class="unread-dot" style="width: 6px; height: 6px; border-radius: 50%;
                                  background: #ef4444; display: ${isUnread ? 'inline-block' : 'none'};"></span>
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 600;
                                    color: var(--text-highlight); line-height: 1.35;
                                    overflow: hidden; text-overflow: ellipsis;
                                    display: -webkit-box; -webkit-line-clamp: 1;
                                    -webkit-box-orient: vertical;">
                            ${escapeHtml(a.title)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
                            ${formatAnnouncementDate(a.created_at)}
                        </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color: var(--text-secondary);
                       font-size: 0.75rem; align-self: center;"></i>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    // ★ 局部更新某一行为已读状态（不重建列表，保留滚动位置）
    function markListRowRead(rowEl) {
        if (!rowEl) return;
        if (rowEl.dataset.unread === '0') return; // 已读无需处理

        rowEl.dataset.unread = '0';
        rowEl.style.background = 'rgba(255,255,255,0.02)';
        rowEl.style.border = '1px solid transparent';
        const dot = rowEl.querySelector('.unread-dot');
        if (dot) dot.style.display = 'none';
    }

    // 绑定点击
    container.querySelectorAll('.announcement-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const a = list.find(x => x.id === id);
            if (!a) return;

            // ★ 关闭详情后只更新这一行，不再重开列表
            showAnnouncementDetail(a, () => {
                markListRowRead(el);
            });
        });
        el.addEventListener('mouseenter', () => {
            el.style.transform = 'translateX(2px)';
            if (el.dataset.unread === '1') {
                el.style.borderColor = 'rgba(96,165,250,0.4)';
            }
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = '';
            if (el.dataset.unread === '1') {
                el.style.borderColor = 'rgba(96,165,250,0.25)';
            }
        });
    });
}

// ==================== 自动弹最新未读 ====================
async function autoShowLatestAnnouncement() {
    const list = await fetchAnnouncements();
    if (!list.length) return;

    const readIds = getReadAnnouncementIds();
    const unread = list.filter(a => !readIds.includes(a.id));
    if (unread.length === 0) return;

    // 只弹最新一条（列表本身按优先级+时间排序）
    const latest = unread[0];

    // 延迟一点，避免和页面其他加载抢注意力
    setTimeout(() => {
        showAnnouncementDetail(latest, () => {
            // markAnnouncementRead 已在 close 内调用，这里只需刷新红点
            // （close 里已经调过 updateAnnouncementBadge，这里不用再调）
        });
    }, 1200);
}

// ==================== 对外暴露 ====================
window.openAnnouncementList = openAnnouncementList;
window.openAnnouncements = openAnnouncementList; // 兼容旧名
window.updateAnnouncementBadge = updateAnnouncementBadge;