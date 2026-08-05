// ========== 日志管理 ==========
import { getSupabase, currentUserRole } from './auth.js';
import { showNotification } from './utils.js';

// ----- 刷新日志 -----
export async function refreshLogs() {
    const sb = getSupabase();
    let query = sb
        .from('admin_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    const searchVal = document.getElementById('logSearch')?.value?.trim()?.toLowerCase();
    const actionFilter = document.getElementById('logActionFilter')?.value;

    if (searchVal) {
        query = query.or(
            `admin_email.ilike.%${searchVal}%,target_name.ilike.%${searchVal}%,details.ilike.%${searchVal}%`
        );
    }
    if (actionFilter) {
        query = query.eq('action_type', actionFilter);
    }

    const { data, error, count } = await query.range(0, 499);

    if (error) {
        console.error('加载日志失败:', error);
        return;
    }

    document.getElementById('totalLogs').innerText = count || 0;

    const container = document.getElementById('logsListArea');
    if (!container) return;

    if (!data || !data.length) {
        container.innerHTML = '<div class="empty-data">暂无日志</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>时间</th>
                    <th>操作人(角色)</th>
                    <th>操作类型</th>
                    <th>目标</th>
                    <th>详情</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const log of data) {
        const time = new Date(log.created_at).toLocaleString('zh-CN');
        const roleDisplay = log.admin_role === 'owner' ? '站长' :
                           log.admin_role === 'admin' ? '管理员' : '用户';

        html += `
            <tr>
                <td>${time}</td>
                <td>
                    ${escapeHtml(log.admin_email)}
                    <br><span style="font-size:0.7rem;">(${roleDisplay})</span>
                </td>
                <td>${escapeHtml(log.action_type)}</td>
                <td>${escapeHtml(log.target_name || log.target_type || '')}</td>
                <td>${escapeHtml(log.details || '')}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ----- 清空日志（仅站长） -----
export async function clearAllLogs() {
    if (currentUserRole !== 'owner') {
        showNotification('只有站长可以清空日志', 'error');
        return;
    }

    if (!confirm('确定清空所有操作日志吗？此操作不可恢复。')) return;

    try {
        const sb = getSupabase();
        const { error } = await sb.from('admin_logs').delete().neq('id', 0);
        if (error) throw error;

        showNotification('日志已清空', 'success');
        await refreshLogs();
    } catch (err) {
        showNotification('清空失败: ' + err.message, 'error');
    }
}

// 辅助：escapeHtml（从 utils 导入）
import { escapeHtml } from './utils.js';