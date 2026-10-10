// ========== 杂项管理（资产/头像框/邮件）v2 —— 邮件系统增强版 ==========
import { getSupabase, currentUser, currentUserRole } from './auth.js';
import {
    showNotification, logAction, openModal, closeModal,
    escapeHtml, getLocalDateString
} from './utils.js';
import { CONFIG, roleConfig } from './config.js';

// ----- 头像框列表（从 CONFIG 读取） -----
const FRAMES = CONFIG.FRAMES || [];

// ============================================================
// 用户资产/头像框/称号/签到卡 相关函数
// ============================================================

// ----- 加载用户头像框 -----
async function loadUserFrames(userId) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from('user_profiles')
        .select('owned_frames')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return ['nature'];
    let owned = data.owned_frames || ['nature'];
    if (!owned.includes('nature')) owned.push('nature');
    return owned;
}

// ----- 更新用户资产（含宝箱） -----
async function updateUserAssets(userId, candy, rainbow, syrup, chest) {
    const sb = getSupabase();
    const updates = {
        candy_crumbles: candy,
        rainbow_lollipops: rainbow,
        dreamy_syrup: syrup
    };
    if (chest !== undefined) updates.chest_count = chest;
    const { error } = await sb
        .from('user_stats')
        .upsert({
            user_id: userId,
            ...updates
        }, { onConflict: 'user_id' });
    if (error) throw new Error('资产更新失败: ' + error.message);
}

// ----- 更新用户头像框 -----
async function updateUserFrames(userId, ownedFrameIds) {
    const sb = getSupabase();
    ownedFrameIds = [...new Set(ownedFrameIds)];
    if (!ownedFrameIds.includes('nature')) ownedFrameIds.push('nature');

    const { error } = await sb
        .from('user_profiles')
        .update({ owned_frames: ownedFrameIds })
        .eq('id', userId);

    if (error) throw new Error('更新头像框失败: ' + error.message);
}

// ----- 更新用户称号 -----
async function updateUserTitles(userId, titleIds) {
    const sb = getSupabase();

    const { data: current, error: fetchErr } = await sb
        .from('user_titles')
        .select('title_id')
        .eq('user_id', userId);

    if (fetchErr) throw new Error('获取当前称号失败: ' + fetchErr.message);

    const currentIds = new Set((current || []).map(t => t.title_id));
    const newIds = new Set(titleIds);

    const toAdd = titleIds.filter(id => !currentIds.has(id));
    const toRemove = (current || [])
        .filter(t => !newIds.has(t.title_id))
        .map(t => t.title_id);

    for (const tid of toAdd) {
        const { error } = await sb
            .from('user_titles')
            .insert({ user_id: userId, title_id: tid });
        if (error) throw new Error('添加称号 ID ' + tid + ' 失败: ' + error.message);
    }

    if (toRemove.length) {
        const { error } = await sb
            .from('user_titles')
            .delete()
            .eq('user_id', userId)
            .in('title_id', toRemove);
        if (error) throw new Error('移除称号失败: ' + error.message);
    }
}

// ----- 更新自动签到卡 -----
async function updateAutoSignCard(userId, hasCard) {
    const sb = getSupabase();
    if (hasCard) {
        const { error } = await sb
            .from('user_auto_sign_card')
            .upsert({ user_id: userId, owned: true }, { onConflict: 'user_id' });
        if (error) throw new Error('授予自动签到卡失败: ' + error.message);
    } else {
        const { error } = await sb
            .from('user_auto_sign_card')
            .delete()
            .eq('user_id', userId);
        if (error) throw new Error('移除自动签到卡失败: ' + error.message);
    }
}

// ============================================================
// 主渲染函数：加载并显示杂项面板
// ============================================================
let selectedMiscUserId = null;
let allUsersForMisc = [];

export async function initMiscPanel() {
    const select = document.getElementById('miscUserSelect');
    if (!select) return;

    const sb = getSupabase();
    const { data: profiles } = await sb
        .from('user_profiles')
        .select('id, username')
        .order('username');

    allUsersForMisc = profiles || [];

    select.innerHTML =
        '<option value="">-- 选择用户 --</option>' +
        allUsersForMisc.map(u =>
            `<option value="${u.id}" ${selectedMiscUserId === u.id ? 'selected' : ''}>
                ${escapeHtml(u.username)} (${u.id.slice(0, 8)})
            </option>`
        ).join('');

    select.onchange = async (e) => {
        selectedMiscUserId = e.target.value;
        if (selectedMiscUserId) {
            try {
                await reloadMiscData(selectedMiscUserId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        } else {
            resetMiscPanels();
        }
    };

    if (selectedMiscUserId) {
        await reloadMiscData(selectedMiscUserId);
    }

    initMailSender();
}

// ----- 重置杂项面板（已修复判空） -----
export function resetMiscPanels() {
    const container = document.getElementById('assetControlArea');
    if (container) {
        container.innerHTML = '<p style="color: var(--text-secondary);">请选择用户</p>';
    }
    const framesArea = document.getElementById('framesManagementArea');
    if (framesArea) framesArea.innerHTML = '';
    const titleSection = document.getElementById('titleManagementArea');
    if (titleSection) titleSection.innerHTML = '';
    const autoSection = document.getElementById('autoCardManagementArea');
    if (autoSection) autoSection.innerHTML = '';
}

// ----- 加载并渲染杂项数据（Tab 版） -----
async function reloadMiscData(userId) {
    const sb = getSupabase();
    const canEdit = currentUserRole === 'owner';
    const targetUser = allUsersForMisc.find(u => u.id === userId);

    // 1. 获取资产（含宝箱）
    const { data: stats, error: statsErr } = await sb
        .from('user_stats')
        .select('candy_crumbles, rainbow_lollipops, dreamy_syrup, chest_count')
        .eq('user_id', userId)
        .maybeSingle();

    if (statsErr && statsErr.code !== 'PGRST116') throw statsErr;

    const candy = stats?.candy_crumbles ?? 100;
    const rainbow = stats?.rainbow_lollipops ?? 5;
    const syrup = stats?.dreamy_syrup ?? 0;
    const chest = stats?.chest_count ?? 0;

    // 2. 获取头像框
    let userFrames = await loadUserFrames(userId);

    // 3. 构建资产 HTML（新增宝箱输入框）
    const assetHtml = `
        <div class="asset-item">
            <img src="${CONFIG.BACKPACK_ITEMS[0].icon}" style="width:24px;height:24px;object-fit:contain;">
            糖果碎: <input type="number" id="miscCandy" value="${candy}" min="0" style="width:100px;" ${canEdit ? '' : 'disabled'}>
        </div>
        <div class="asset-item">
            <img src="${CONFIG.BACKPACK_ITEMS[1].icon}" style="width:24px;height:24px;object-fit:contain;">
            超级棒糖: <input type="number" id="miscRainbow" value="${rainbow}" min="0" style="width:100px;" ${canEdit ? '' : 'disabled'}>
        </div>
        <div class="asset-item">
            <img src="${CONFIG.BACKPACK_ITEMS[2].icon}" style="width:24px;height:24px;object-fit:contain;">
            梦幻星河糖浆: <input type="number" id="miscSyrup" value="${syrup}" min="0" style="width:100px;" ${canEdit ? '' : 'disabled'}>
        </div>
        <div class="asset-item">
            🎁 宝箱: <input type="number" id="miscChest" value="${chest}" min="0" style="width:100px;" ${canEdit ? '' : 'disabled'}>
        </div>
        ${canEdit
            ? '<button class="save-asset-btn" id="saveAssetBtn"><i class="fas fa-save"></i> 保存资产修改</button>'
            : '<span style="color: var(--text-secondary);">仅站长可修改资产</span>'
        }
    `;

    // 4. 构建头像框 HTML
    let framesHtml = '<div class="frames-grid">';
    for (const frame of FRAMES) {
        if (frame.id === 'nature') continue;
        const isOwned = userFrames.includes(frame.id);
        framesHtml += `
            <label class="frame-checkbox-item">
                <input type="checkbox" class="frame-checkbox" data-frame-id="${frame.id}"
                    ${isOwned ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}>
                <div class="frame-name">${escapeHtml(frame.name)}</div>
            </label>
        `;
    }
    framesHtml += '</div>';
    framesHtml += `
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
            ✅ 默认头像框（不可取消）
        </div>
    `;
    if (canEdit) {
        framesHtml += '<button class="save-frames-btn" id="saveFramesBtn"><i class="fas fa-save"></i> 保存头像框修改</button>';
    } else {
        framesHtml += '<span style="color: var(--text-secondary);">仅站长可修改头像框拥有状态</span>';
    }

    // 5. 构建称号 HTML
    const { data: allTitles, error: titlesErr } = await sb
        .from('titles')
        .select('id, name, description, is_limited');

    let titlesHtml = '<div style="color: var(--text-secondary);">加载称号失败</div>';
    if (!titlesErr && allTitles) {
        const { data: userTitles } = await sb
            .from('user_titles')
            .select('title_id')
            .eq('user_id', userId);

        const ownedTitleIds = new Set((userTitles || []).map(t => t.title_id));

        titlesHtml = '<div class="frames-grid" id="titlesGrid">';
        for (const title of allTitles) {
            const isOwned = ownedTitleIds.has(title.id);
            const limitedBadge = title.is_limited ? ' [限定]' : '';
            titlesHtml += `
                <label class="frame-checkbox-item" style="justify-content: space-between; width: calc(50% - 12px);">
                    <div>
                        <strong>${escapeHtml(title.name)}</strong>${limitedBadge}
                        <br><span style="font-size:0.7rem;">${escapeHtml(title.description || '')}</span>
                    </div>
                    <input type="checkbox" class="title-checkbox" data-title-id="${title.id}"
                        ${isOwned ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}>
                </label>
            `;
        }
        titlesHtml += '</div>';
        if (canEdit) {
            titlesHtml += '<button class="save-frames-btn" id="saveTitlesBtn"><i class="fas fa-save"></i> 保存徽章修改</button>';
        } else {
            titlesHtml += '<span style="color: var(--text-secondary);">仅站长可修改徽章拥有状态</span>';
        }
    }

    // 6. 构建自动签到卡 HTML
    const { data: autoCard } = await sb
        .from('user_auto_sign_card')
        .select('owned')
        .eq('user_id', userId)
        .maybeSingle();

    const hasAutoCard = autoCard?.owned === true;
    const autoHtml = `
        <div style="display: flex; align-items: center; gap: 20px; margin: 10px 0; flex-wrap:wrap;">
            <span>当前状态: ${hasAutoCard ? '已拥有 ✅' : '未拥有 ❌'}</span>
            ${canEdit
                ? `<button id="toggleAutoCardBtn" class="save-asset-btn" style="background: ${hasAutoCard ? '#c41e3a' : '#10b981'};">
                    ${hasAutoCard ? '移除卡片' : '授予卡片'}
                </button>`
                : '<span style="color: var(--text-secondary);">仅站长可修改</span>'
            }
        </div>
    `;

    // ============================================================
    // Tab 切换结构
    // ============================================================
    const tabHtml = `
        <div class="misc-tabs" style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
            <button class="misc-tab-btn active" data-tab="assets" style="padding:6px 18px; border-radius:20px; border:none; cursor:pointer; background:#3b82f6; color:white; font-size:0.9rem;">💰 资产</button>
            <button class="misc-tab-btn" data-tab="frames" style="padding:6px 18px; border-radius:20px; border:none; cursor:pointer; background:transparent; color:var(--text-secondary); font-size:0.9rem;">🖼️ 头像框</button>
            <button class="misc-tab-btn" data-tab="titles" style="padding:6px 18px; border-radius:20px; border:none; cursor:pointer; background:transparent; color:var(--text-secondary); font-size:0.9rem;">🏅 称号</button>
            <button class="misc-tab-btn" data-tab="autocard" style="padding:6px 18px; border-radius:20px; border:none; cursor:pointer; background:transparent; color:var(--text-secondary); font-size:0.9rem;">📅 签到卡</button>
        </div>

        <div id="miscTabContent">
            <div class="misc-tab-panel" data-panel="assets" style="display:block;">
                ${assetHtml}
            </div>
            <div class="misc-tab-panel" data-panel="frames" style="display:none;">
                ${framesHtml}
            </div>
            <div class="misc-tab-panel" data-panel="titles" style="display:none;">
                ${titlesHtml}
            </div>
            <div class="misc-tab-panel" data-panel="autocard" style="display:none;">
                ${autoHtml}
            </div>
        </div>
    `;

    const container = document.getElementById('assetControlArea');
    if (container) {
        container.innerHTML = tabHtml;
    }
    const framesArea = document.getElementById('framesManagementArea');
    if (framesArea) framesArea.innerHTML = '';
    const titleSection = document.getElementById('titleManagementArea');
    if (titleSection) titleSection.innerHTML = '';
    const autoSection = document.getElementById('autoCardManagementArea');
    if (autoSection) autoSection.innerHTML = '';

    // Tab 切换事件
    document.querySelectorAll('.misc-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            document.querySelectorAll('.misc-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-secondary)';
            });
            this.classList.add('active');
            this.style.background = '#3b82f6';
            this.style.color = 'white';
            document.querySelectorAll('.misc-tab-panel').forEach(p => {
                p.style.display = p.dataset.panel === tab ? 'block' : 'none';
            });
        });
    });

    // 资产保存
    if (canEdit) {
        document.getElementById('saveAssetBtn')?.addEventListener('click', async () => {
            const nc = parseInt(document.getElementById('miscCandy').value, 10);
            const nr = parseInt(document.getElementById('miscRainbow').value, 10);
            const ns = parseInt(document.getElementById('miscSyrup').value, 10);
            const nch = parseInt(document.getElementById('miscChest').value, 10);

            if (isNaN(nc) || isNaN(nr) || isNaN(ns) || isNaN(nch) || nc < 0 || nr < 0 || ns < 0 || nch < 0) {
                showNotification('请输入非负整数', 'error');
                return;
            }

            try {
                await updateUserAssets(userId, nc, nr, ns, nch);
                await logAction(
                    '资产调整',
                    'user_stats',
                    userId,
                    targetUser?.username || userId,
                    `糖果碎: ${candy} → ${nc}, 棒糖: ${rainbow} → ${nr}, 星河糖浆: ${syrup} → ${ns}, 宝箱: ${chest} → ${nch}`
                );
                showNotification('资产已更新', 'success');
                await reloadMiscData(userId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    // 头像框保存
    if (canEdit) {
        document.getElementById('saveFramesBtn')?.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.frame-checkbox');
            const newOwned = ['nature'];
            checkboxes.forEach(cb => {
                if (cb.checked) newOwned.push(cb.dataset.frameId);
            });

            try {
                const existing = await loadUserFrames(userId);
                await updateUserFrames(userId, newOwned);
                const added = newOwned.filter(id => !existing.includes(id));
                const removed = existing.filter(id => !newOwned.includes(id) && id !== 'nature');
                await logAction(
                    '头像框调整',
                    'user_frames',
                    userId,
                    targetUser?.username || userId,
                    '新增: ' + added.join(',') + ', 移除: ' + removed.join(',')
                );
                showNotification('头像框拥有状态已更新', 'success');
                await reloadMiscData(userId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    // 称号保存
    if (canEdit) {
        document.getElementById('saveTitlesBtn')?.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.title-checkbox');
            const newOwnedIds = [];
            checkboxes.forEach(cb => {
                if (cb.checked) newOwnedIds.push(parseInt(cb.dataset.titleId));
            });

            try {
                await updateUserTitles(userId, newOwnedIds);
                await logAction(
                    '徽章调整',
                    'user_titles',
                    userId,
                    targetUser?.username || userId,
                    '称号ID列表: ' + newOwnedIds.join(',')
                );
                showNotification('徽章已更新', 'success');
                await reloadMiscData(userId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    // 自动签到卡切换
    if (canEdit) {
        document.getElementById('toggleAutoCardBtn')?.addEventListener('click', async () => {
            const newHas = !hasAutoCard;
            try {
                await updateAutoSignCard(userId, newHas);
                await logAction(
                    '自动签到卡调整',
                    'user_auto_sign_card',
                    userId,
                    targetUser?.username || userId,
                    '新状态: ' + (newHas ? '授予' : '移除')
                );
                showNotification('自动签到卡已' + (newHas ? '授予' : '移除'), 'success');
                await reloadMiscData(userId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }
}

// ============================================================
// 系统邮件发送（v2 —— 支持全部 8 种奖励类型 + 模板 + 预览）
// ============================================================

// ---- 附件类型配置 ----
const MAIL_ATTACH_TYPES = [
    { value: 'candy',   label: '🍬 糖果碎',   inputType: 'amount', color: '#fbbf24' },
    { value: 'rainbow', label: '🌈 超级棒糖', inputType: 'amount', color: '#f472b6' },
    { value: 'syrup',   label: '🌌 星河糖浆', inputType: 'amount', color: '#a78bfa' },
    { value: 'active',  label: '⚡ 活跃度',   inputType: 'amount', color: '#60a5fa' },
    { value: 'chest',   label: '🎁 神秘宝箱', inputType: 'amount', color: '#f59e0b' },
    { value: 'title',   label: '🏅 称号',     inputType: 'title',  color: '#a78bfa' },
    { value: 'frame',   label: '🖼️ 头像框',   inputType: 'frame',  color: '#22d3ee' },
    { value: 'item',    label: '🏆 唯一道具', inputType: 'item',   color: '#f59e0b' }
];

// ---- 唯一道具列表（与 email_address.html 的 ITEM_CONFIG 保持一致） ----
const UNIQUE_ITEMS_LIST = [
    { id: 'trophy_1st_hidden', name: '一周年·隐藏纪念杯' }
];

// ---- 邮件模板 ----
const MAIL_TEMPLATES = {
    checkin_compensation: {
        title: '📅 签到补偿',
        sender: '小兹',
        content: '亲爱的旅人，\n\n经查您的签到记录存在异常，特此补发补偿奖励。\n\n感谢您的理解与支持！',
        attachments: [
            { type: 'candy', amount: 10000 },
            { type: 'rainbow', amount: 100 }
        ]
    },
    event_reward: {
        title: '🎉 活动奖励发放',
        sender: '小兹',
        content: '恭喜您在本次活动中获奖！\n\n奖励已发放至邮箱，请查收。\n\n祝您游戏愉快～',
        attachments: [
            { type: 'candy', amount: 5000 },
            { type: 'syrup', amount: 10 }
        ]
    },
    version_update: {
        title: '✨ 版本更新奖励',
        sender: '小兹',
        content: '感谢大家对本WIKI的支持！\n\n本次更新带来了一些新内容，特此发放更新奖励。\n\n请查收～',
        attachments: [
            { type: 'candy', amount: 2000 },
            { type: 'chest', amount: 3 }
        ]
    },
    apology: {
        title: '🙇 致歉补偿',
        sender: '小兹',
        content: '非常抱歉给您的使用带来了不便。\n\n我们已修复相关问题，特此奉上补偿奖励。\n\n感谢您的耐心与包容！',
        attachments: [
            { type: 'candy', amount: 20000 },
            { type: 'rainbow', amount: 200 },
            { type: 'syrup', amount: 20 }
        ]
    }
};

// ---- 缓存 ----
let cachedTitleOptions = [];
let cachedFrameOptions = [];

// ---- 加载称号和头像框选项 ----
async function loadMailOptions() {
    const sb = getSupabase();
    const { data: titles } = await sb.from('titles').select('id, name').order('name');
    cachedTitleOptions = titles || [];
    cachedFrameOptions = CONFIG.FRAMES.filter(f => f.id !== 'nature').map(f => ({ id: f.id, name: f.name }));
}

// ---- 生成单条附件行 HTML ----
function createAttachmentRowHTML(type = 'candy', value = '10') {
    const cfg = MAIL_ATTACH_TYPES.find(t => t.value === type) || MAIL_ATTACH_TYPES[0];

    // 类型下拉
    const typeOptions = MAIL_ATTACH_TYPES.map(t =>
        `<option value="${t.value}" ${t.value === type ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    // 数字输入
    const numberInput = `<input type="number" class="attach-amount"
        value="${cfg.inputType === 'amount' ? value : '1'}" min="1"
        style="width:100%; display:${cfg.inputType === 'amount' ? 'block' : 'none'}; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:8px 12px; border-radius:8px;">`;

    // 称号下拉
    let titleOptions = '<option value="">-- 选择称号 --</option>';
    for (const t of cachedTitleOptions) {
        const sel = (cfg.inputType === 'title' && String(t.id) === String(value)) ? 'selected' : '';
        titleOptions += `<option value="${t.id}" ${sel}>${escapeHtml(t.name)} (ID: ${t.id})</option>`;
    }
    const titleSelect = `<select class="attach-title-select"
        style="width:100%; display:${cfg.inputType === 'title' ? 'block' : 'none'}; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:8px 12px; border-radius:8px;">${titleOptions}</select>`;

    // 头像框下拉
    let frameOptions = '<option value="">-- 选择头像框 --</option>';
    for (const f of cachedFrameOptions) {
        const sel = (cfg.inputType === 'frame' && String(f.id) === String(value)) ? 'selected' : '';
        frameOptions += `<option value="${f.id}" ${sel}>${escapeHtml(f.name)} (ID: ${f.id})</option>`;
    }
    const frameSelect = `<select class="attach-frame-select"
        style="width:100%; display:${cfg.inputType === 'frame' ? 'block' : 'none'}; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:8px 12px; border-radius:8px;">${frameOptions}</select>`;

    // 唯一道具下拉
    let itemOptions = '<option value="">-- 选择道具 --</option>';
    for (const it of UNIQUE_ITEMS_LIST) {
        const sel = (cfg.inputType === 'item' && String(it.id) === String(value)) ? 'selected' : '';
        itemOptions += `<option value="${it.id}" ${sel}>${escapeHtml(it.name)} (${it.id})</option>`;
    }
    const itemSelect = `<select class="attach-item-select"
        style="width:100%; display:${cfg.inputType === 'item' ? 'block' : 'none'}; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:8px 12px; border-radius:8px;">${itemOptions}</select>`;

    return `
        <div class="attach-row" style="
            display:flex; gap:8px; margin-bottom:8px; align-items:center;
            background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:10px;
            border:1px solid rgba(255,255,255,0.06); flex-wrap:wrap;
        ">
            <select class="attach-type" style="
                width:140px; flex-shrink:0;
                background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15);
                color:#fff; padding:8px 10px; border-radius:8px; font-size:0.85rem;
            ">${typeOptions}</select>

            <div style="flex:1; min-width:140px;">
                ${numberInput}
                ${titleSelect}
                ${frameSelect}
                ${itemSelect}
            </div>

            <button type="button" class="remove-attach-btn" style="
                background:rgba(248,113,113,0.15); color:#f87171;
                border:1px solid rgba(248,113,113,0.3); padding:8px 12px;
                border-radius:8px; cursor:pointer; flex-shrink:0;
                font-size:0.85rem;
            "><i class="fas fa-trash"></i></button>
        </div>
    `;
}

// ---- 添加附件行 ----
function addAttachmentRow(container, type = 'candy', value = '10') {
    const div = document.createElement('div');
    div.innerHTML = createAttachmentRowHTML(type, value);
    const row = div.firstElementChild;

    const typeSelect = row.querySelector('.attach-type');
    const numberInput = row.querySelector('.attach-amount');
    const titleSelect = row.querySelector('.attach-title-select');
    const frameSelect = row.querySelector('.attach-frame-select');
    const itemSelect = row.querySelector('.attach-item-select');

    function switchInputs() {
        const t = typeSelect.value;
        const cfg = MAIL_ATTACH_TYPES.find(x => x.value === t);
        numberInput.style.display = cfg.inputType === 'amount' ? 'block' : 'none';
        titleSelect.style.display = cfg.inputType === 'title' ? 'block' : 'none';
        frameSelect.style.display = cfg.inputType === 'frame' ? 'block' : 'none';
        itemSelect.style.display = cfg.inputType === 'item' ? 'block' : 'none';
        updatePreview();
    }

    typeSelect.addEventListener('change', switchInputs);

    // 所有输入控件变化时刷新预览
    numberInput.addEventListener('input', updatePreview);
    titleSelect.addEventListener('change', updatePreview);
    frameSelect.addEventListener('change', updatePreview);
    itemSelect.addEventListener('change', updatePreview);

    row.querySelector('.remove-attach-btn').addEventListener('click', () => {
        row.remove();
        updatePreview();
    });

    container.appendChild(row);
    updatePreview();
}

// ---- 实时更新预览 ----
function updatePreview() {
    const previewBox = document.getElementById('mailPreviewBox');
    if (!previewBox) return;

    const rows = document.querySelectorAll('#attachmentsList .attach-row');
    if (rows.length === 0) {
        previewBox.innerHTML = '<span style="color:var(--text-secondary);">暂无附件</span>';
        return;
    }

    const parts = [];
    rows.forEach(row => {
        const type = row.querySelector('.attach-type').value;
        const cfg = MAIL_ATTACH_TYPES.find(x => x.value === type);
        if (!cfg) return;

        if (cfg.inputType === 'amount') {
            const amt = parseInt(row.querySelector('.attach-amount').value) || 0;
            if (amt > 0) parts.push(`<span style="color:${cfg.color};">${cfg.label} ×${amt.toLocaleString()}</span>`);
        } else if (cfg.inputType === 'title') {
            const v = row.querySelector('.attach-title-select').value;
            const opt = cachedTitleOptions.find(t => String(t.id) === v);
            if (opt) parts.push(`<span style="color:${cfg.color};">🏅 ${escapeHtml(opt.name)}</span>`);
        } else if (cfg.inputType === 'frame') {
            const v = row.querySelector('.attach-frame-select').value;
            const opt = cachedFrameOptions.find(f => f.id === v);
            if (opt) parts.push(`<span style="color:${cfg.color};">🖼️ ${escapeHtml(opt.name)}</span>`);
        } else if (cfg.inputType === 'item') {
            const v = row.querySelector('.attach-item-select').value;
            const opt = UNIQUE_ITEMS_LIST.find(i => i.id === v);
            if (opt) parts.push(`<span style="color:${cfg.color};">🏆 ${escapeHtml(opt.name)}</span>`);
        }
    });

    previewBox.innerHTML = parts.length === 0
        ? '<span style="color:var(--text-secondary);">暂无有效附件</span>'
        : parts.join('<br>');
}

// ---- 应用模板 ----
function applyMailTemplate(templateKey) {
    const tpl = MAIL_TEMPLATES[templateKey];
    if (!tpl) return;

    document.getElementById('mailTitle').value = tpl.title || '';
    document.getElementById('mailContent').value = tpl.content || '';
    document.getElementById('mailSenderName').value = tpl.sender || '小兹';

    const container = document.getElementById('attachmentsList');
    container.innerHTML = '';
    for (const item of (tpl.attachments || [])) {
        let v = '1';
        if (['candy', 'rainbow', 'syrup', 'active', 'chest'].includes(item.type)) {
            v = String(item.amount || 1);
        } else if (item.type === 'title') {
            v = String(item.title_id || '');
        } else if (item.type === 'frame') {
            v = item.frame_id || '';
        } else if (item.type === 'item') {
            v = item.item_id || '';
        }
        addAttachmentRow(container, item.type, v);
    }
    updatePreview();
}

// ---- 初始化邮件发送器 ----
function initMailSender() {
    const container = document.getElementById('attachmentsList');
    if (!container) return;

    // 加载称号和头像框选项
    loadMailOptions().then(() => {
        container.innerHTML = '';
        addAttachmentRow(container, 'candy', '10');
    }).catch(err => {
        console.warn('加载邮件选项失败:', err);
        container.innerHTML = '';
        addAttachmentRow(container, 'candy', '10');
    });

    // 添加按钮
    document.getElementById('addAttachRowBtn')?.addEventListener('click', () => {
        addAttachmentRow(container, 'candy', '10');
    });

    // 模板选择
    document.getElementById('mailTemplateSelect')?.addEventListener('change', function() {
        if (!this.value) return;
        if (this.value === 'custom') {
            document.getElementById('mailTitle').value = '';
            document.getElementById('mailContent').value = '';
            return;
        }
        applyMailTemplate(this.value);
    });

    // 初始化目标用户下拉
    const mailTarget = document.getElementById('mailTargetUser');
    if (mailTarget) {
        setTimeout(async () => {
            if (allUsersForMisc.length === 0) {
                const sb = getSupabase();
                const { data } = await sb
                    .from('user_profiles')
                    .select('id, username')
                    .order('username');
                allUsersForMisc = data || [];
            }
            mailTarget.innerHTML =
                '<option value="all">📢 全体用户</option>' +
                allUsersForMisc.map(u =>
                    `<option value="${u.id}">${escapeHtml(u.username)} (${u.id.slice(0, 8)})</option>`
                ).join('');
        }, 100);
    }

    // 发送按钮
    document.getElementById('sendMailBtn')?.addEventListener('click', sendSystemMail);
}

// ---- 发送邮件 ----
async function sendSystemMail() {
    const target = document.getElementById('mailTargetUser').value;
    const title = document.getElementById('mailTitle').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    const senderName = document.getElementById('mailSenderName').value.trim() || null;

    if (!title || !content) {
        showNotification('标题和内容不能为空', 'error');
        return;
    }

    // 解析附件
    const attachments = [];
    const rows = document.querySelectorAll('#attachmentsList .attach-row');
    for (const row of rows) {
        const type = row.querySelector('.attach-type').value;
        const cfg = MAIL_ATTACH_TYPES.find(x => x.value === type);
        if (!cfg) continue;

        let item = { type };

        if (cfg.inputType === 'amount') {
            const amt = parseInt(row.querySelector('.attach-amount').value);
            if (isNaN(amt) || amt < 1) {
                showNotification('数量必须为正整数', 'error');
                return;
            }
            item.amount = amt;
        } else if (cfg.inputType === 'title') {
            const v = row.querySelector('.attach-title-select').value;
            if (!v) { showNotification('请选择称号', 'error'); return; }
            item.title_id = parseInt(v);
        } else if (cfg.inputType === 'frame') {
            const v = row.querySelector('.attach-frame-select').value;
            if (!v) { showNotification('请选择头像框', 'error'); return; }
            item.frame_id = v;
        } else if (cfg.inputType === 'item') {
            const v = row.querySelector('.attach-item-select').value;
            if (!v) { showNotification('请选择唯一道具', 'error'); return; }
            item.item_id = v;
            item.amount = 1;
        }
        attachments.push(item);
    }

    if (attachments.length === 0) {
        showNotification('请至少添加一项奖励', 'error');
        return;
    }

    // 目标用户
    let targetIds = [];
    if (target === 'all') {
        targetIds = allUsersForMisc.map(u => u.id);
    } else {
        targetIds = [target];
    }
    if (!targetIds.length) {
        showNotification('没有可发送的用户', 'error');
        return;
    }

    // 组装邮件对象
    const sb = getSupabase();
    const mails = targetIds.map(to_user_id => {
        const mail = {
            to_user_id,
            title,
            content,
            claimable_items: attachments,
            created_by_admin: currentUser.id
        };
        if (senderName) mail.sender_name = senderName;
        return mail;
    });

    // 发送进度条
    const progressWrap = document.getElementById('mailSendProgress');
    const progressBar = document.getElementById('mailProgressBar');
    const progressText = document.getElementById('mailProgressText');
    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = `正在发送 0 / ${mails.length}...`;

    // 批量发送
    const BATCH = 50;
    let success = 0;
    const sendBtn = document.getElementById('sendMailBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
        for (let i = 0; i < mails.length; i += BATCH) {
            const batch = mails.slice(i, i + BATCH);
            const { error } = await sb.from('user_mails').insert(batch);
            if (error) throw new Error(error.message);
            success += batch.length;
            const pct = Math.round((success / mails.length) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressText) progressText.textContent = `正在发送 ${success} / ${mails.length}...`;
        }

        if (progressText) progressText.textContent = `✅ 已发送 ${success} 封`;
        showNotification(`成功发送 ${success} 封邮件`, 'success');

        await logAction(
            '发送系统邮件',
            'user_mails',
            '',
            targetIds.length + '人',
            '标题: ' + title + ' | 署名: ' + (senderName || '系统')
        );

        // 清空表单
        document.getElementById('mailTitle').value = '';
        document.getElementById('mailContent').value = '';
        document.getElementById('mailTemplateSelect').value = '';
        const container = document.getElementById('attachmentsList');
        if (container) {
            container.innerHTML = '';
            addAttachmentRow(container, 'candy', '10');
        }
        updatePreview();

        // 3 秒后收起进度条
        setTimeout(() => {
            if (progressWrap) progressWrap.style.display = 'none';
        }, 3000);
    } catch (err) {
        showNotification('发送失败: ' + err.message, 'error');
        if (progressText) progressText.textContent = `❌ 已发送 ${success} / ${mails.length} 时中断`;
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// 导出重置函数供外部使用
export { resetMiscPanels as _resetMiscPanel };