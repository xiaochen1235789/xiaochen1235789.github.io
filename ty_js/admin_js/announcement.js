// ========== 公告管理（含傻瓜编辑器） ==========
import { getSupabase } from './auth.js';
import { showNotification, logAction, openModal, closeModal, escapeHtml } from './utils.js';

let announcementsCache = [];
let currentEditorMode = 'simple'; // 'simple' | 'html'

const ANNOUNCEMENT_TYPES = [
    { value: 'update', label: '更新公告', color: '#60a5fa' },
    { value: 'event',  label: '活动公告', color: '#f472b6' },
    { value: 'notice', label: '重要通知', color: '#facc15' },
    { value: 'fix',    label: '问题修复', color: '#3ecf8e' }
];

// ============================================================
// 简易语法 → HTML 转换引擎
// ============================================================
function simpleTextToHtml(text) {
    if (!text || !text.trim()) return '';

    // 1. 全字段转义（防 XSS）
    const escaped = escapeHtml(text);

    // 2. 按行解析
    const lines = escaped.split('\n');
    const blocks = [];
    let paragraph = [];
    let inList = false;

    const flushParagraph = () => {
        if (paragraph.length) {
            blocks.push({ type: 'p', lines: paragraph.slice() });
            paragraph = [];
        }
    };
    const closeList = () => {
        if (inList) { blocks.push({ type: 'ul-end' }); inList = false; }
    };

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        const trimmed = line.trim();

        // 空行 → 段落分隔
        if (trimmed === '') {
            closeList();
            flushParagraph();
            continue;
        }

        // 分隔线 ---
        if (/^-{3,}$/.test(trimmed)) {
            closeList(); flushParagraph();
            blocks.push({ type: 'hr' });
            continue;
        }

        // 标题 ## / ###
        const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (hMatch) {
            closeList(); flushParagraph();
            const level = Math.min(hMatch[1].length + 2, 5); // ## → h4
            blocks.push({ type: 'h', level, content: hMatch[2] });
            continue;
        }

        // 列表 - 或 *
        if (/^[-*]\s+/.test(trimmed)) {
            flushParagraph();
            if (!inList) { blocks.push({ type: 'ul-start' }); inList = true; }
            blocks.push({ type: 'li', content: trimmed.replace(/^[-*]\s+/, '') });
            continue;
        }

        // 引用 >
        if (/^>\s?/.test(trimmed)) {
            closeList(); flushParagraph();
            blocks.push({ type: 'quote', content: trimmed.replace(/^>\s?/, '') });
            continue;
        }

        // 普通行
        closeList();
        paragraph.push(line);
    }

    closeList();
    flushParagraph();

    // 3. 渲染
    let html = '';
    for (const b of blocks) {
        switch (b.type) {
            case 'hr':
                html += '<hr style="border:none;border-top:1px dashed rgba(255,255,255,0.15);margin:16px 0;">';
                break;
            case 'h':
                html += `<h${b.level} style="color:#facc15;margin:16px 0 8px;font-size:1.05rem;">${inlineMarkup(b.content)}</h${b.level}>`;
                break;
            case 'ul-start':
                html += '<ul style="padding-left:22px;margin:8px 0;">';
                break;
            case 'ul-end':
                html += '</ul>';
                break;
            case 'li':
                html += `<li style="margin:5px 0;">${inlineMarkup(b.content)}</li>`;
                break;
            case 'quote':
                html += `<blockquote style="border-left:3px solid #60a5fa;padding:8px 14px;margin:10px 0;background:rgba(96,165,250,0.08);color:#cbd5e1;border-radius:0 6px 6px 0;">${inlineMarkup(b.content)}</blockquote>`;
                break;
            case 'p':
                html += `<p style="margin:8px 0;line-height:1.85;">${inlineMarkup(b.lines.join('<br>'))}</p>`;
                break;
        }
    }
    return html;
}

// 行内标记（输入已经是转义过的）
function inlineMarkup(text) {
    let r = text;

    // 【高亮】
    r = r.replace(/【([^】]+)】/g, '<span style="color:#facc15;font-weight:bold;">$1</span>');

    // **加粗**
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>');

    // *斜体*（避免与加粗冲突）
    r = r.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

    // `行内代码`
    r = r.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.9em;">$1</code>');

    // {color:xxx} 颜色标记
    const colorMap = {
        red: '#f87171', blue: '#60a5fa', green: '#4ade80',
        yellow: '#facc15', pink: '#f472b6', purple: '#a78bfa', orange: '#fb923c'
    };
    r = r.replace(/\{(red|blue|green|yellow|pink|purple|orange):([^}]+)\}/g,
        (m, c, content) => `<span style="color:${colorMap[c]};">${content}</span>`);

    return r;
}

// ============================================================
// HTML 模式安全过滤
// ============================================================
function sanitizeHtml(html) {
    if (!html) return '';
    let r = html;
    // 干掉 script / iframe / object / embed
    r = r.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    r = r.replace(/<iframe\b[^>]*>.*?<\/iframe>/gis, '');
    r = r.replace(/<object\b[^>]*>.*?<\/object>/gis, '');
    r = r.replace(/<embed\b[^>]*>/gi, '');
    // 干掉 on* 事件
    r = r.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // 干掉 javascript: 协议
    r = r.replace(/javascript\s*:/gi, '');
    return r;
}

// ============================================================
// 实时预览
// ============================================================
function updateAnnPreview() {
    const preview = document.getElementById('annPreviewBox');
    const textarea = document.getElementById('annContentInput');
    if (!preview || !textarea) return;

    const raw = textarea.value;
    let html;

    if (currentEditorMode === 'simple') {
        html = simpleTextToHtml(raw);
    } else {
        html = sanitizeHtml(raw);
    }

    if (!html.trim()) {
        preview.innerHTML = '<div style="color:#6b7280;text-align:center;padding:20px;font-size:0.85rem;">← 左侧输入内容，这里会实时显示效果</div>';
    } else {
        preview.innerHTML = html;
    }
}

// ============================================================
// 光标处插入标记（工具栏按钮）
// ============================================================
window._annInsert = function(before, after = '', placeholder = '') {
    const ta = document.getElementById('annContentInput');
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end) || placeholder;

    const insertText = before + selected + after;
    ta.value = ta.value.substring(0, start) + insertText + ta.value.substring(end);

    ta.focus();
    // 选中插入的文本（去掉前后标记）
    const selStart = start + before.length;
    ta.selectionStart = selStart;
    ta.selectionEnd = selStart + selected.length;

    updateAnnPreview();
};

// ============================================================
// 切换编辑器模式
// ============================================================
window._annSwitchMode = function(mode) {
    currentEditorMode = mode;

    const btnSimple = document.getElementById('annModeSimple');
    const btnHtml = document.getElementById('annModeHtml');
    const toolbar = document.getElementById('annSimpleToolbar');
    const hint = document.getElementById('annModeHint');
    const ta = document.getElementById('annContentInput');

    const activeStyle = 'background:#3b82f6;color:white;';
    const inactiveStyle = 'background:transparent;color:#9ca3af;';

    if (mode === 'simple') {
        btnSimple.style.cssText = `padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;${activeStyle}`;
        btnHtml.style.cssText = `padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;${inactiveStyle}`;
        toolbar.style.display = 'flex';
        hint.innerHTML = '💡 直接写文字即可，空行分段落。<strong>**加粗**</strong> · <strong>【高亮】</strong> · <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">- 列表</code> · <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">&gt; 引用</code> · <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">---</code> 分隔线';
        ta.placeholder = '六哥荣耀WIKI 更新公告\n\n好久不见，星启者们\n\n【本次更新内容】\n\n- 修复了签到按钮不刷新的问题\n- 优化了买宝箱的速度\n\n---\n\n接下来，周年庆准备正式开始！🎂';
        ta.style.fontFamily = 'inherit';
        ta.style.fontSize = '0.95rem';
    } else {
        btnSimple.style.cssText = `padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;${inactiveStyle}`;
        btnHtml.style.cssText = `padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;${activeStyle}`;
        toolbar.style.display = 'none';
        hint.innerHTML = '⚠️ 高级模式：直接写 HTML。系统会过滤 <code>&lt;script&gt;</code> 和 <code>on*</code> 事件，但请谨慎使用。';
        ta.placeholder = '<p>本次更新内容...</p>\n<p><strong>重要提示：</strong>...</p>';
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '0.85rem';
    }

    updateAnnPreview();
};

// ============================================================
// 加载公告列表
// ============================================================
export async function loadAnnouncements() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('site_announcements')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        announcementsCache = data || [];
        renderAnnouncementsTable();
    } catch (err) {
        showNotification('加载公告失败: ' + err.message, 'error');
    }
}

// ============================================================
// 渲染公告表格
// ============================================================
function renderAnnouncementsTable() {
    const container = document.getElementById('announcementsListArea');
    if (!container) return;

    if (!announcementsCache.length) {
        container.innerHTML = '<div class="empty-data">暂无公告，点击「发布公告」创建</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>类型</th>
                    <th>版本</th>
                    <th>标题</th>
                    <th>优先级</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const a of announcementsCache) {
        const typeInfo = ANNOUNCEMENT_TYPES.find(t => t.value === a.type) || ANNOUNCEMENT_TYPES[0];
        const activeBadge = a.is_active
            ? `<span style="color:#4ade80;">✅ 已发布</span>`
            : `<span style="color:#9ca3af;">⏸️ 已下线</span>`;

        html += `
            <tr>
                <td><span style="color:${typeInfo.color};font-size:0.85rem;">● ${typeInfo.label}</span></td>
                <td>${escapeHtml(a.version || '-')}</td>
                <td title="${escapeHtml(a.title)}"><strong>${escapeHtml(a.title)}</strong></td>
                <td>${a.priority}</td>
                <td>${activeBadge}</td>
                <td>${new Date(a.created_at).toLocaleString('zh-CN')}</td>
                <td class="action-buttons">
                    <button class="edit-btn" onclick="window.editAnnouncement('${a.id}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="edit-btn" style="background:${a.is_active ? '#6b7280' : '#10b981'};" onclick="window.toggleAnnouncement('${a.id}')">
                        <i class="fas ${a.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i> ${a.is_active ? '下线' : '上线'}
                    </button>
                    <button class="delete-btn" onclick="window.deleteAnnouncement('${a.id}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================================
// 公告表单（含编辑器）
// ============================================================
function showAnnouncementForm(existingData = null) {
    const isEdit = !!existingData;

    const typeOptions = ANNOUNCEMENT_TYPES.map(t =>
        `<option value="${t.value}" ${existingData?.type === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    const formatDateForInput = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const initialContent = existingData?.content || '';
    const hasHtml = /<\w+/.test(initialContent);
    // 编辑已有公告：如果内容含 HTML 标签，默认 HTML 模式；否则简易模式
    currentEditorMode = (isEdit && hasHtml) ? 'html' : 'simple';

    const html = `
        <div class="form-field">
            <label>公告类型</label>
            <select name="type" class="form-select">${typeOptions}</select>
        </div>
        <div class="form-field">
            <label>版本号（可选）</label>
            <input type="text" name="version" value="${escapeHtml(existingData?.version || '')}" placeholder="例如：V2.0.0" maxlength="20">
        </div>
        <div class="form-field">
            <label>标题 <span style="color:#f87171;">*</span></label>
            <input type="text" name="title" value="${escapeHtml(existingData?.title || '')}" placeholder="例如：🎉 六哥荣耀WIKI 更新公告" required maxlength="100">
        </div>

        <!-- ★ 编辑器区域 ★ -->
        <div class="form-field">
            <label>公告内容 <span style="color:#f87171;">*</span></label>

            <!-- 模式切换 -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <button type="button" id="annModeSimple" onclick="window._annSwitchMode('simple')"
                    style="padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;">
                    ✏️ 简易模式
                </button>
                <button type="button" id="annModeHtml" onclick="window._annSwitchMode('html')"
                    style="padding:6px 18px;border-radius:20px;border:none;cursor:pointer;font-size:0.85rem;">
                    💻 HTML模式
                </button>
            </div>

            <!-- 工具栏（仅简易模式显示） -->
            <div id="annSimpleToolbar" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
                <button type="button" onclick="window._annInsert('**', '**', '加粗文字')" title="加粗" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:0.85rem;">B</button>
                <button type="button" onclick="window._annInsert('*', '*', '斜体文字')" title="斜体" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:4px 12px;border-radius:6px;cursor:pointer;font-style:italic;font-size:0.85rem;">I</button>
                <button type="button" onclick="window._annInsert('【', '】', '高亮')" title="高亮" style="background:rgba(250,204,21,0.15);border:1px solid rgba(250,204,21,0.3);color:#facc15;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">【高亮】</button>
                <button type="button" onclick="window._annInsert('## ', '', '标题')" title="标题" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">## 标题</button>
                <button type="button" onclick="window._annInsert('- ', '', '列表项')" title="列表" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">- 列表</button>
                <button type="button" onclick="window._annInsert('> ', '', '引用内容')" title="引用" style="background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.3);color:#60a5fa;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">&gt; 引用</button>
                <button type="button" onclick="window._annInsert('\\n---\\n', '')" title="分隔线" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">--- 分隔</button>
                <button type="button" onclick="window._annInsert('{yellow:', '}', '醒目文字')" title="黄色" style="background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.2);color:#facc15;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">🎨 黄</button>
                <button type="button" onclick="window._annInsert('{pink:', '}', '粉色文字')" title="粉色" style="background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.2);color:#f472b6;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">🎨 粉</button>
                <button type="button" onclick="window._annInsert('{green:', '}', '绿色文字')" title="绿色" style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:#4ade80;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">🎨 绿</button>
                <button type="button" onclick="window._annInsert('{blue:', '}', '蓝色文字')" title="蓝色" style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.85rem;">🎨 蓝</button>
            </div>

            <!-- 输入区 + 预览区（左右并排） -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:4px;">输入区</div>
                    <textarea id="annContentInput" rows="14" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);color:#e0e0e0;padding:10px 12px;border-radius:8px;resize:vertical;line-height:1.7;" oninput="window._annUpdatePreview && window._annUpdatePreview()">${escapeHtml(initialContent)}</textarea>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:4px;">👁️ 预览区</div>
                    <div id="annPreviewBox" style="width:100%;height:calc(100% - 22px);min-height:280px;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.1);color:#e0e0e0;padding:10px 14px;border-radius:8px;overflow-y:auto;font-size:0.9rem;line-height:1.7;"></div>
                </div>
            </div>

            <!-- 语法提示 -->
            <div id="annModeHint" style="font-size:0.75rem;color:#9ca3af;background:rgba(0,0,0,0.2);padding:8px 12px;border-radius:6px;margin-top:8px;line-height:1.7;"></div>
        </div>

        <div class="form-field">
            <label>优先级（数字越大越靠前，重要公告建议 100）</label>
            <input type="number" name="priority" value="${existingData?.priority ?? 0}" min="0">
        </div>
        <div class="form-field">
            <label>开始展示时间（留空 = 立即生效）</label>
            <input type="datetime-local" name="start_at" value="${formatDateForInput(existingData?.start_at)}">
        </div>
        <div class="form-field">
            <label>结束展示时间（留空 = 永久有效）</label>
            <input type="datetime-local" name="end_at" value="${formatDateForInput(existingData?.end_at)}">
        </div>
        <div class="form-field">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" name="is_active" ${existingData?.is_active !== false ? 'checked' : ''}>
                立即发布（勾选后用户可见）
            </label>
        </div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = isEdit ? '编辑公告' : '发布公告';
    document.getElementById('modalFields').innerHTML = html;

    // 初始化编辑器
    window._annUpdatePreview = updateAnnPreview;
    window._annSwitchMode(currentEditorMode);

    // 提交
    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        const title = fd.get('title')?.trim();
        const rawContent = document.getElementById('annContentInput').value;

        if (!title || !rawContent.trim()) {
            showNotification('标题和内容不能为空', 'error');
            return;
        }

        // ★ 根据模式生成最终 HTML
        let finalContent;
        if (currentEditorMode === 'simple') {
            finalContent = simpleTextToHtml(rawContent);
        } else {
            finalContent = sanitizeHtml(rawContent);
        }

        const parseTimeOrNull = (val) => val ? new Date(val).toISOString() : null;

        const data = {
            type: fd.get('type') || 'update',
            version: fd.get('version')?.trim() || null,
            title,
            content: finalContent,
            priority: parseInt(fd.get('priority')) || 0,
            start_at: parseTimeOrNull(fd.get('start_at')) || new Date().toISOString(),
            end_at: parseTimeOrNull(fd.get('end_at')),
            is_active: fd.get('is_active') === 'on'
        };

        try {
            const sb = getSupabase();
            const result = isEdit
                ? await sb.from('site_announcements').update(data).eq('id', existingData.id)
                : await sb.from('site_announcements').insert([data]);

            if (result.error) throw result.error;

            await logAction(
                isEdit ? '编辑公告' : '发布公告',
                'site_announcements',
                isEdit ? existingData.id : '',
                title,
                `${data.type} | 版本:${data.version || '-'} | 优先级:${data.priority}`
            );

            showNotification(isEdit ? '公告已更新' : '公告已发布', 'success');
            closeModal('genericModal');
            await loadAnnouncements();
        } catch (err) {
            showNotification('操作失败: ' + err.message, 'error');
        }
    };
}

// ============================================================
// 导出：新增按钮入口
// ============================================================
export function showAddAnnouncementForm() {
    showAnnouncementForm(null);
}

// ============================================================
// window 挂载
// ============================================================
window.editAnnouncement = function(id) {
    const data = announcementsCache.find(a => a.id === id);
    if (!data) { showNotification('公告不存在', 'error'); return; }
    showAnnouncementForm(data);
};

window.deleteAnnouncement = async function(id) {
    const data = announcementsCache.find(a => a.id === id);
    if (!data) return;
    if (!confirm(`确定删除公告「${data.title}」吗？此操作不可恢复。`)) return;

    try {
        const sb = getSupabase();
        const { error } = await sb.from('site_announcements').delete().eq('id', id);
        if (error) throw error;
        await logAction('删除公告', 'site_announcements', id, data.title, '');
        showNotification('公告已删除', 'success');
        await loadAnnouncements();
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};

window.toggleAnnouncement = async function(id) {
    const data = announcementsCache.find(a => a.id === id);
    if (!data) return;
    try {
        const sb = getSupabase();
        const newState = !data.is_active;
        const { error } = await sb
            .from('site_announcements')
            .update({ is_active: newState })
            .eq('id', id);
        if (error) throw error;
        await logAction(newState ? '上线公告' : '下线公告', 'site_announcements', id, data.title, '');
        showNotification(newState ? '公告已上线' : '公告已下线', 'success');
        await loadAnnouncements();
    } catch (err) {
        showNotification('操作失败: ' + err.message, 'error');
    }
};