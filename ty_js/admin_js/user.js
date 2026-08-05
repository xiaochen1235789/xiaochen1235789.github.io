// ========== 用户管理（列表 / 搜索 / 改角色 / 删除） ==========
import { getSupabase, currentUser, currentUserRole } from './auth.js';
import { showNotification, logAction, openModal, closeModal, escapeHtml } from './utils.js';
import { roleConfig, OWNER_ID } from './config.js';

let allUsers = [];

// ----- 获取所有用户（含资产） -----
export async function fetchAllUsers() {
    const sb = getSupabase();
    const { data: profiles } = await sb
        .from('user_profiles')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false });

    const { data: stats } = await sb
        .from('user_stats')
        .select('user_id, candy_crumbles, rainbow_lollipops, active_points, checkin_streak, dreamy_syrup');

    const map = new Map();
    if (stats) {
        stats.forEach(s => {
            map.set(s.user_id, {
                candy: s.candy_crumbles ?? 100,
                rainbow: s.rainbow_lollipops ?? 5,
                active: s.active_points ?? 0,
                streak: s.checkin_streak ?? 0,
                syrup: s.dreamy_syrup ?? 0
            });
        });
    }

    return (profiles || []).map(p => {
        const isOwner = p.id === OWNER_ID;
        return {
            ...p,
            role: isOwner ? 'owner' : p.role,
            candy_crumbles: map.get(p.id)?.candy ?? 100,
            rainbow_lollipops: map.get(p.id)?.rainbow ?? 5,
            active_points: map.get(p.id)?.active ?? 0,
            streak: map.get(p.id)?.streak ?? 0,
            dreamy_syrup: map.get(p.id)?.syrup ?? 0
        };
    });
}

// ----- 渲染用户表格 -----
export function renderUsersTable(users) {
    const container = document.getElementById('usersListArea');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = '<div class="empty-data">暂无用户</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>用户名</th>
                    <th>角色</th>
                    <th>🍬 糖果碎</th>
                    <th>🌈 超级棒糖</th>
                    <th>🌌 星河糖浆</th>
                    <th>⚡ 活跃度</th>
                    <th>🔥 连续签到</th>
                    <th>注册时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const u of users) {
        const ri = roleConfig[u.role] || roleConfig.user;
        const isOwner = u.id === OWNER_ID;
        const isSelf = u.id === currentUser.id;

        // 权限：能否改角色（站长可改任何人，管理员不可改站长和自己）
        const canEdit = (currentUserRole === 'owner' && !isOwner) ||
                        (currentUserRole === 'admin' && !isOwner && !isSelf);
        // 权限：能否删除（仅站长可删，且不能删站长和自己）
        const canDel = (currentUserRole === 'owner' && !isOwner && !isSelf);

        html += `
            <tr>
                <td>
                    <strong>${escapeHtml(u.username)}</strong>
                    <br><span style="font-size:0.7rem;color:var(--text-secondary);">${u.id.slice(0,8)}...</span>
                </td>
                <td><span class="role-badge ${ri.class}">${ri.name}</span></td>
                <td>🍬 ${u.candy_crumbles.toLocaleString()}</td>
                <td>🌈 ${u.rainbow_lollipops.toLocaleString()}</td>
                <td>🌌 ${u.dreamy_syrup.toLocaleString()}</td>
                <td>⚡ ${u.active_points.toLocaleString()}</td>
                <td>🔥 ${u.streak}天</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '未知'}</td>
                <td class="action-buttons">
                    ${canEdit ? `<button class="edit-btn" onclick="window.openUserRoleModal('${u.id}','${escapeHtml(u.username)}','${u.role}')"><i class="fas fa-user-tag"></i> 改角色</button>` : ''}
                    ${canDel ? `<button class="delete-btn" onclick="window.deleteUserById('${u.id}','${escapeHtml(u.username)}')"><i class="fas fa-trash"></i> 删除</button>` : ''}
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // 更新总用户数
    const totalEl = document.getElementById('totalUsers');
    if (totalEl) totalEl.innerText = users.length;
}

// ----- 刷新用户列表（搜索过滤） -----
export async function refreshUserList() {
    try {
        allUsers = await fetchAllUsers();
        applyUserSearchFilter();
    } catch (e) {
        showNotification('刷新用户列表失败: ' + e.message, 'error');
    }
}

// ----- 搜索过滤（由搜索框触发） -----
export function applyUserSearchFilter() {
    const keyword = document.getElementById('searchUsers')?.value?.trim()?.toLowerCase() || '';
    if (!keyword) {
        renderUsersTable(allUsers);
    } else {
        const filtered = allUsers.filter(u => u.username.toLowerCase().includes(keyword));
        renderUsersTable(filtered);
    }
}

// ============================================================
// ★★★ 以下函数挂载到 window，供 HTML onclick 调用 ★★★
// ============================================================

// ----- 打开修改角色模态框 -----
window.openUserRoleModal = async function (userId, username, currentRole) {
    // 权限二次校验
    if (userId === OWNER_ID || userId === currentUser.id) {
        showNotification('无法修改此用户角色', 'error');
        return;
    }

    // 构建下拉选项
    let opts = `
        <option value="user" ${currentRole === 'user' ? 'selected' : ''}>普通用户</option>
        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>管理员</option>
    `;
    if (currentUserRole === 'owner') {
        opts += `<option value="owner" ${currentRole === 'owner' ? 'selected' : ''}>站长</option>`;
    }

    const fieldsHtml = `
        <div class="form-field">
            <label>用户：${escapeHtml(username)}</label>
            <select id="newRoleSelect" class="form-select">${opts}</select>
        </div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '修改用户角色';
    document.getElementById('modalFields').innerHTML = fieldsHtml;

    // 提交事件
    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const newRole = document.getElementById('newRoleSelect').value;
        if (newRole === currentRole) {
            closeModal('genericModal');
            return;
        }

        try {
            const sb = getSupabase();
            await sb.from('user_profiles').update({ role: newRole }).eq('id', userId);
            showNotification('角色已更新', 'success');
            await refreshUserList();
            await logAction('修改用户角色', 'user', userId, username, `角色由 ${currentRole} 改为 ${newRole}`);
            closeModal('genericModal');
        } catch (err) {
            showNotification('修改失败: ' + err.message, 'error');
        }
    };
};

// ----- 删除用户 -----
window.deleteUserById = async function (userId, username) {
    if (userId === OWNER_ID || userId === currentUser.id) {
        showNotification('无法删除此用户', 'error');
        return;
    }
    if (!confirm(`确定永久删除「${username}」吗？此操作不可恢复！`)) return;

    try {
        const sb = getSupabase();
        await sb.from('user_profiles').delete().eq('id', userId);
        showNotification('已删除用户', 'success');
        await refreshUserList();
        // 如果杂项面板选中的用户被删了，重置选择
        const miscSelect = document.getElementById('miscUserSelect');
        if (miscSelect && miscSelect.value === userId) {
            miscSelect.value = '';
            if (window._resetMiscPanel) window._resetMiscPanel();
        }
        await logAction('删除用户', 'user', userId, username, `删除了用户 ${username}`);
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};