// ========== 杂项管理（资产/头像框/邮件） ==========
import { getSupabase, currentUser, currentUserRole } from './auth.js';
import {
    showNotification, logAction, openModal, closeModal,
    escapeHtml, getLocalDateString
} from './utils.js';
import { CONFIG, roleConfig } from './config.js';

// ----- 头像框列表（从 CONFIG 读取） -----
const FRAMES = CONFIG.FRAMES || [];

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

// ----- 更新用户资产 -----
async function updateUserAssets(userId, candy, rainbow, syrup) {
    const sb = getSupabase();
    const { error } = await sb
        .from('user_stats')
        .upsert({
            user_id: userId,
            candy_crumbles: candy,
            rainbow_lollipops: rainbow,
            dreamy_syrup: syrup
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

    // 获取当前称号
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

    // 加载用户列表
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

// ----- 重置杂项面板 -----
export function resetMiscPanels() {
    document.getElementById('assetControlArea').innerHTML =
        '<p style="color: var(--text-secondary);">请选择用户</p>';
    document.getElementById('framesManagementArea').innerHTML =
        '<p style="color: var(--text-secondary);">请选择用户</p>';
    const titleSection = document.getElementById('titleManagementArea');
    if (titleSection) titleSection.innerHTML = '';
    const autoSection = document.getElementById('autoCardManagementArea');
    if (autoSection) autoSection.innerHTML = '';
}

// ----- 加载并渲染杂项数据 -----
async function reloadMiscData(userId) {
    const sb = getSupabase();
    const canEdit = currentUserRole === 'owner';
    const targetUser = allUsersForMisc.find(u => u.id === userId);

    // 1. 获取资产
    const { data: stats, error: statsErr } = await sb
        .from('user_stats')
        .select('candy_crumbles, rainbow_lollipops, dreamy_syrup')
        .eq('user_id', userId)
        .maybeSingle();

    if (statsErr && statsErr.code !== 'PGRST116') throw statsErr;

    const candy = stats?.candy_crumbles ?? 100;
    const rainbow = stats?.rainbow_lollipops ?? 5;
    const syrup = stats?.dreamy_syrup ?? 0;

    // 2. 获取头像框
    let userFrames = await loadUserFrames(userId);

    // 3. 渲染资产控制
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
        ${canEdit
            ? '<button class="save-asset-btn" id="saveAssetBtn"><i class="fas fa-save"></i> 保存资产修改</button>'
            : '<span style="color: var(--text-secondary);">仅站长可修改资产</span>'
        }
    `;

    document.getElementById('assetControlArea').innerHTML = assetHtml;

    if (canEdit) {
        document.getElementById('saveAssetBtn')?.addEventListener('click', async () => {
            const nc = parseInt(document.getElementById('miscCandy').value, 10);
            const nr = parseInt(document.getElementById('miscRainbow').value, 10);
            const ns = parseInt(document.getElementById('miscSyrup').value, 10);

            if (isNaN(nc) || isNaN(nr) || isNaN(ns) || nc < 0 || nr < 0 || ns < 0) {
                showNotification('请输入非负整数', 'error');
                return;
            }

            try {
                await updateUserAssets(userId, nc, nr, ns);
                await logAction(
                    '资产调整',
                    'user_stats',
                    userId,
                    targetUser?.username || userId,
                    `糖果碎: ${candy} → ${nc}, 棒糖: ${rainbow} → ${nr}, 星河糖浆: ${syrup} → ${ns}`
                );
                showNotification('资产已更新', 'success');
                await reloadMiscData(userId);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    // 4. 渲染头像框（从 CONFIG.FRAMES 读取）
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

    // 默认头像框单独显示
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

    document.getElementById('framesManagementArea').innerHTML = framesHtml;

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

    // 5. 称号管理
    const { data: allTitles, error: titlesErr } = await sb
        .from('titles')
        .select('id, name, description, is_limited');

    if (!titlesErr && allTitles) {
        const { data: userTitles } = await sb
            .from('user_titles')
            .select('title_id')
            .eq('user_id', userId);

        const ownedTitleIds = new Set((userTitles || []).map(t => t.title_id));

        let titlesHtml = `
            <div class="misc-title"><i class="fas fa-medal"></i> 徽章（称号）管理</div>
            <div class="frames-grid" id="titlesGrid">
        `;

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

        let titleSection = document.getElementById('titleManagementArea');
        if (!titleSection) {
            const sec = document.createElement('div');
            sec.className = 'misc-section';
            sec.id = 'titleManagementArea';
            document.getElementById('misc-panel').appendChild(sec);
            titleSection = sec;
        }
        titleSection.innerHTML = titlesHtml;

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
    }

    // 6. 自动签到卡
    const { data: autoCard } = await sb
        .from('user_auto_sign_card')
        .select('owned')
        .eq('user_id', userId)
        .maybeSingle();

    const hasAutoCard = autoCard?.owned === true;

    const autoHtml = `
        <div class="misc-title"><i class="fas fa-calendar-check"></i> 自动签到卡</div>
        <div style="display: flex; align-items: center; gap: 20px; margin: 10px 0;">
            <span>当前状态: ${hasAutoCard ? '已拥有 ✅' : '未拥有 ❌'}</span>
            ${canEdit
                ? `<button id="toggleAutoCardBtn" class="save-asset-btn" style="background: ${hasAutoCard ? '#c41e3a' : '#10b981'};">
                    ${hasAutoCard ? '移除卡片' : '授予卡片'}
                </button>`
                : '<span style="color: var(--text-secondary);">仅站长可修改</span>'
            }
        </div>
    `;

    let autoSection = document.getElementById('autoCardManagementArea');
    if (!autoSection) {
        const sec = document.createElement('div');
        sec.className = 'misc-section';
        sec.id = 'autoCardManagementArea';
        document.getElementById('misc-panel').appendChild(sec);
        autoSection = sec;
    }
    autoSection.innerHTML = autoHtml;

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
// 系统邮件发送
// ============================================================

function addAttachmentRow(container) {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '8px';
    div.innerHTML = `
        <select class="attach-type" style="width:120px;">
            <option value="candy">🍬 糖果碎</option>
            <option value="rainbow">🌈 彩虹棒糖</option>
            <option value="title">🏅 称号</option>
            <option value="frame">🖼️ 头像框</option>
        </select>
        <input type="number" class="attach-amount" placeholder="数量/ID" value="10" style="width:100px;">
        <button type="button" class="remove-attach-btn" style="background:#f87171;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;">-</button>
    `;
    div.querySelector('.remove-attach-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

function initMailSender() {
    const container = document.getElementById('attachmentsList');
    if (!container) return;

    container.innerHTML = '';
    addAttachmentRow(container);

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-attach-btn')) {
            addAttachmentRow(container);
        }
    });

    // 加载用户列表到邮件收件人下拉
    const mailTarget = document.getElementById('mailTargetUser');
    if (mailTarget) {
        // 使用已缓存的用户列表
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

    document.getElementById('sendMailBtn')?.addEventListener('click', sendSystemMail);
}

async function sendSystemMail() {
    const target = document.getElementById('mailTargetUser').value;
    const title = document.getElementById('mailTitle').value.trim();
    const content = document.getElementById('mailContent').value.trim();

    if (!title || !content) {
        showNotification('标题和内容不能为空', 'error');
        return;
    }

    const attachments = [];
    document.querySelectorAll('#attachmentsList > div').forEach(row => {
        const type = row.querySelector('.attach-type').value;
        const amount = row.querySelector('.attach-amount').value;
        if (!amount) return;

        if (type === 'candy' || type === 'rainbow') {
            attachments.push({ type, amount: parseInt(amount) });
        } else if (type === 'title') {
            attachments.push({ type, title_id: parseInt(amount) });
        } else if (type === 'frame') {
            attachments.push({ type, frame_id: amount });
        }
    });

    // 获取目标用户列表
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

    const sb = getSupabase();
    const mails = targetIds.map(to_user_id => ({
        to_user_id,
        title,
        content,
        claimable_items: attachments,
        created_by_admin: currentUser.id
    }));

    const batchSize = 50;
    let success = 0;

    for (let i = 0; i < mails.length; i += batchSize) {
        const batch = mails.slice(i, i + batchSize);
        const { error } = await sb.from('user_mails').insert(batch);
        if (error) {
            showNotification('发送失败: ' + error.message, 'error');
            return;
        }
        success += batch.length;
    }

    showNotification('成功发送 ' + success + ' 封邮件', 'success');
    await logAction(
        '发送系统邮件',
        'user_mails',
        '',
        targetIds.length + '人',
        '标题: ' + title
    );

    document.getElementById('mailTitle').value = '';
    document.getElementById('mailContent').value = '';
    const container = document.getElementById('attachmentsList');
    if (container) {
        container.innerHTML = '';
        addAttachmentRow(container);
    }
}

// 导出重置函数供外部使用
export { resetMiscPanels as _resetMiscPanel };