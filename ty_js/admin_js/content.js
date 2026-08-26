// ========== 内容管理（角色 / 光锥 / 材料 / 道具） ==========
import { getSupabase } from './auth.js';
import {
    showNotification, logAction, openModal, closeModal,
    escapeHtml
} from './utils.js';
import { TABLE_SCHEMA } from './config.js';
import { openCharDetailEditor } from './char_detail.js';

// ----- 缓存数据 -----
const currentDataCache = {
    characters: [],
    light_cones: [],
    materials: [],
    items: []
};

// ----- 辅助：表名转中文 -----
function getTableChinese(table) {
    const map = {
        characters: '角色',
        light_cones: '光锥',
        materials: '材料',
        items: '道具'
    };
    return map[table] || table;
}

// ----- 加载数据 -----
export async function loadContentTable(table) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from(table)
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;

        currentDataCache[table] = data || [];
        renderContentTable(table, currentDataCache[table]);
    } catch (err) {
        showNotification('加载 ' + getTableChinese(table) + ' 失败: ' + err.message, 'error');
    }
}

// ----- 渲染表格 -----
export function renderContentTable(table, data) {
    const container = document.getElementById(table + '-table-container');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-data">暂无数据，点击「添加」创建</div>';
        return;
    }

    // 定义要显示的列
    let headers = [];
    if (table === 'characters') {
        headers = ['name', 'description', 'element', 'path', 'rarity', 'version', 'image_url', 'detail_url', 'is_limited', 'display_order'];
    } else if (table === 'light_cones') {
        headers = ['name', 'description', 'path', 'character_id', 'image_url', 'detail_url', 'display_order'];
    } else {
        headers = ['name', 'description', 'rarity', 'image_url', 'detail_url', 'display_order'];
    }

    // 中文表头映射
    const headerMap = {
        'name': '名称',
        'description': '描述',
        'element': '属性',
        'path': '命途',
        'rarity': '稀有度',
        'version': '版本',
        'image_url': '图片',
        'detail_url': '详情页',
        'is_limited': '是否限定',
        'display_order': '排序',
        'character_id': '关联角色ID'
    };

    let html = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>';
    headers.forEach(h => html += `<th>${headerMap[h] || h}</th>`);
    html += '<th>操作</th></tr></thead><tbody>';

    for (const row of data) {
        html += '<tr>';
        for (const h of headers) {
            let val = row[h];
            if (val === undefined || val === null) val = '';

            if (h === 'image_url' && val) {
                val = `<img src="${escapeHtml(String(val))}" class="table-img" onerror="this.style.display=\'none\'">`;
            } else if (h === 'is_limited') {
                val = val ? '是' : '否';
            } else {
                val = escapeHtml(String(val));
            }
            html += `<td title="${val}">${val}</td>`;
        }
        // ★★★ 关键修复：优先使用 slug（文本标识），若无则回退到数字 id ★★★
        const detailId = row.slug || row.id;
        html += `
            <td class="action-buttons">
                <button class="edit-btn" onclick="window.editContentItem('${table}', '${row.id}')">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="edit-btn" style="background:#8b5cf6;" onclick="window._openCharDetail('${detailId}')">
                    <i class="fas fa-file-alt"></i> 详情
                </button>
                <button class="delete-btn" onclick="window.deleteContentItem('${table}', '${row.id}')">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </td>
        `;
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ----- 搜索过滤 -----
export function filterContentTable(table) {
    const input = document.getElementById('search-' + table);
    if (!input) return;

    const keyword = input.value.trim().toLowerCase();
    const data = currentDataCache[table] || [];

    if (!keyword) {
        renderContentTable(table, data);
    } else {
        const filtered = data.filter(item =>
            item.name && item.name.toLowerCase().includes(keyword)
        );
        renderContentTable(table, filtered);
    }
}

// ----- 打开添加/编辑表单 -----
export function showContentForm(table, existingData = null) {
    const isEdit = !!existingData;
    const schema = TABLE_SCHEMA[table];
    if (!schema) {
        showNotification('未知数据表', 'error');
        return;
    }

    // 构建表单 HTML
    let html = '';
    for (const field of schema.fields) {
        let val = existingData ? existingData[field.name] : (field.default !== undefined ? field.default : '');
        if (field.type === 'checkbox') {
            val = val === true || val === 1;
        }

        let inputHtml = '';
        if (field.type === 'checkbox') {
            inputHtml = `<input type="checkbox" name="${field.name}" ${val ? 'checked' : ''}>`;
        } else if (field.type === 'select') {
            inputHtml = `<select name="${field.name}" class="form-select">`;
            if (field.options) {
                field.options.forEach(opt => {
                    const selected = (opt === val) ? 'selected' : '';
                    inputHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
                });
            }
            inputHtml += `</select>`;
        } else {
            const type = field.type === 'number' ? 'number' : 'text';
            const required = field.required ? 'required' : '';
            const step = field.type === 'number' ? 'step="any"' : '';
            inputHtml = `<input type="${type}" name="${field.name}" value="${escapeHtml(String(val ?? ''))}" ${required} ${step}>`;
        }

        html += `
            <div class="form-field">
                <label>${field.label}</label>
                ${inputHtml}
            </div>
        `;
    }

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = isEdit ? '编辑 ' + getTableChinese(table) : '添加 ' + getTableChinese(table);
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = {};

        for (const field of schema.fields) {
            if (field.type === 'checkbox') {
                data[field.name] = formData.get(field.name) === 'on';
            } else if (field.type === 'select') {
                data[field.name] = formData.get(field.name) || '';
            } else if (field.type === 'number') {
                const raw = formData.get(field.name);
                data[field.name] = raw ? Number(raw) : 0;
            } else {
                data[field.name] = formData.get(field.name) || '';
            }
        }

        try {
            const sb = getSupabase();
            let result;

            if (isEdit) {
                result = await sb.from(table).update(data).eq('id', existingData.id);
            } else {
                result = await sb.from(table).insert([data]);
            }

            if (result.error) throw result.error;

            const actionType = isEdit ? '编辑' + getTableChinese(table) : '添加' + getTableChinese(table);
            const targetName = data.name || existingData?.name || '未命名';
            await logAction(
                actionType,
                table,
                isEdit ? existingData.id : '',
                targetName,
                JSON.stringify(data)
            );

            showNotification(isEdit ? '更新成功' : '添加成功', 'success');
            closeModal('genericModal');

            await loadContentTable(table);
            filterContentTable(table);
        } catch (err) {
            showNotification('操作失败: ' + err.message, 'error');
        }
    };
}

// ============================================================
// ★★★ 以下函数挂载到 window ★★★
// ============================================================

window.editContentItem = async function (table, id) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        showContentForm(table, data);
    } catch (err) {
        showNotification('加载数据失败: ' + err.message, 'error');
    }
};

window.deleteContentItem = async function (table, id) {
    if (!confirm('确定删除这条记录吗？')) return;

    try {
        const sb = getSupabase();
        const { data: item } = await sb
            .from(table)
            .select('name')
            .eq('id', id)
            .single();

        const targetName = item?.name || '未知';

        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) throw error;

        showNotification('删除成功', 'success');
        await logAction(
            '删除' + getTableChinese(table),
            table,
            id,
            targetName,
            '删除了 ' + targetName
        );

        await loadContentTable(table);
        filterContentTable(table);
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};

// ★★★ 角色详情编辑器入口（直接传递字符串 ID） ★★★
window._openCharDetail = function(charId) {
    if (!charId) {
        showNotification('无效的角色标识', 'error');
        return;
    }
    openCharDetailEditor(charId);
};