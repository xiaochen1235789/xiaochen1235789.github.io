// ========== 签到配置管理 ==========
import { getSupabase } from './auth.js';
import { showNotification, logAction, openModal, closeModal } from './utils.js';

let checkinConfigs = [];

// ----- 加载配置 -----
export async function loadCheckinConfigs() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('checkin_config')
            .select('*')
            .order('day_num', { ascending: true });

        if (error) throw error;
        checkinConfigs = data || [];
        renderCheckinTable();
    } catch (err) {
        showNotification('加载签到配置失败: ' + err.message, 'error');
    }
}

// ----- 渲染表格 -----
function renderCheckinTable() {
    const container = document.getElementById('checkinListArea');
    if (!container) return;

    if (!checkinConfigs.length) {
        container.innerHTML = '<div class="empty-data">暂无签到配置，点击「添加配置」创建</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>天数</th>
                    <th>🍬 糖果碎</th>
                    <th>🌈 彩虹棒糖</th>
                    <th>⚡ 活跃度</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const row of checkinConfigs) {
        const dayDisplay = row.day_num === 9999 ? '30天以上' : '第' + row.day_num + '天';
        html += `
            <tr>
                <td><strong>${dayDisplay}</strong></td>
                <td>${row.candy.toLocaleString()}</td>
                <td>${row.rainbow.toLocaleString()}</td>
                <td>${row.active.toLocaleString()}</td>
                <td class="action-buttons">
                    <button class="edit-btn" onclick="window.editCheckinConfig(${row.id})">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="delete-btn" onclick="window.deleteCheckinConfig(${row.id}, ${row.day_num})">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ----- 显示表单 -----
function showCheckinForm(existingData = null) {
    const isEdit = !!existingData;

    const html = `
        <div class="form-field">
            <label>签到天数 <span style="color:var(--text-secondary);font-size:0.8rem;">(9999 = 30天以上通用奖励)</span></label>
            <input type="number" name="day_num" value="${isEdit ? existingData.day_num : ''}"
                ${isEdit ? 'readonly style="opacity:0.6;"' : 'required'}>
        </div>
        <div class="form-field">
            <label>🍬 糖果碎</label>
            <input type="number" name="candy" value="${isEdit ? existingData.candy : 80}" required min="0">
        </div>
        <div class="form-field">
            <label>🌈 彩虹棒糖</label>
            <input type="number" name="rainbow" value="${isEdit ? existingData.rainbow : 15}" required min="0">
        </div>
        <div class="form-field">
            <label>⚡ 活跃度</label>
            <input type="number" name="active" value="${isEdit ? existingData.active : 20}" required min="0">
        </div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = isEdit ? '编辑签到配置' : '添加签到配置';
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();

        const fd = new FormData(e.target);
        const dayNum = parseInt(fd.get('day_num'));
        const candy = parseInt(fd.get('candy')) || 0;
        const rainbow = parseInt(fd.get('rainbow')) || 0;
        const active = parseInt(fd.get('active')) || 0;

        if (isNaN(dayNum) || dayNum < 0) {
            showNotification('请输入有效天数', 'error');
            return;
        }

        if (dayNum !== 9999 && dayNum > 30) {
            showNotification('天数不能超过30，如需30天以上请使用9999', 'error');
            return;
        }

        const duplicate = checkinConfigs.find(c =>
            c.day_num === dayNum && (!isEdit || c.id !== existingData.id)
        );

        if (duplicate) {
            showNotification('天数 ' + dayNum + ' 已存在配置', 'error');
            return;
        }

        try {
            const sb = getSupabase();
            const data = { day_num: dayNum, candy, rainbow, active };
            let result;

            if (isEdit) {
                result = await sb.from('checkin_config').update(data).eq('id', existingData.id);
            } else {
                result = await sb.from('checkin_config').insert([data]);
            }

            if (result.error) throw result.error;

            const actionType = isEdit ? '编辑签到配置' : '添加签到配置';
            await logAction(
                actionType,
                'checkin_config',
                isEdit ? existingData.id : '',
                '第' + dayNum + '天',
                JSON.stringify(data)
            );

            showNotification(isEdit ? '配置已更新' : '配置已添加', 'success');
            closeModal('genericModal');
            await loadCheckinConfigs();
        } catch (err) {
            showNotification('操作失败: ' + err.message, 'error');
        }
    };
}

// ============================================================
// 挂载到 window
// ============================================================

window.editCheckinConfig = async function (id) {
    const data = checkinConfigs.find(c => c.id === id);
    if (!data) {
        showNotification('配置不存在', 'error');
        return;
    }
    showCheckinForm(data);
};

window.deleteCheckinConfig = async function (id, dayNum) {
    const dayDisplay = dayNum === 9999 ? '「30天以上」' : '「第' + dayNum + '天」';
    if (!confirm('确定删除 ' + dayDisplay + ' 签到配置吗？')) return;

    try {
        const sb = getSupabase();
        await sb.from('checkin_config').delete().eq('id', id);
        showNotification('配置已删除', 'success');
        await logAction('删除签到配置', 'checkin_config', id, '第' + dayNum + '天', '');
        await loadCheckinConfigs();
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};

// 导出 showCheckinForm 供 main.js 绑定按钮
export { showCheckinForm };