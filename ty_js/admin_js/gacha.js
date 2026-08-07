// ========== 抽卡配置管理（卡池 / 池子项目 / 全局概率） ==========
import { getSupabase } from './auth.js';
import { showNotification, logAction, openModal, closeModal, escapeHtml } from './utils.js';

// ----- 卡池管理 -----
let currentBanners = [];

export async function loadBanners() {
    const sb = getSupabase();
    const { data } = await sb
        .from('gacha_banners')
        .select('*')
        .order('display_order');

    currentBanners = data || [];
    renderBannersTable();
}

function renderBannersTable() {
    const container = document.getElementById('bannersListArea');
    if (!container) return;

    if (!currentBanners.length) {
        container.innerHTML = '<div class="empty-data">暂无卡池</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>标识</th>
                    <th>名称</th>
                    <th>UP五星</th>
                    <th>UP列表</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>激活</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const b of currentBanners) {
        // 解析 UP 列表显示
        let upListDisplay = '';
        if (b.up_five_star_list && Array.isArray(b.up_five_star_list) && b.up_five_star_list.length > 0) {
            upListDisplay = b.up_five_star_list.join(' · ');
        } else if (b.up_five_star) {
            if (b.up_five_star.includes(',')) {
                upListDisplay = b.up_five_star.split(',').map(s => s.trim()).join(' · ');
            } else {
                upListDisplay = b.up_five_star;
            }
        }

        html += `
            <tr>
                <td><code>${escapeHtml(b.banner_key)}</code></td>
                <td>${escapeHtml(b.name)}</td>
                <td>${escapeHtml(b.up_five_star || '')}</td>
                <td><span style="color:#facc15;font-size:0.85rem;">${escapeHtml(upListDisplay) || '-'}</span></td>
                <td>${new Date(b.start_time).toLocaleString()}</td>
                <td>${new Date(b.end_time).toLocaleString()}</td>
                <td>
                    <input type="checkbox" class="banner-active" data-id="${b.id}" ${b.is_active ? 'checked' : ''}>
                </td>
                <td class="action-buttons">
                    <button class="edit-btn" onclick="window.editBanner(${b.id})">编辑</button>
                    <button class="delete-btn" onclick="window.deleteBanner(${b.id})">删除</button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // 激活切换事件
    document.querySelectorAll('.banner-active').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            const id = parseInt(cb.dataset.id);
            const isActive = cb.checked;

            const sb = getSupabase();
            if (isActive) {
                await sb.from('gacha_banners').update({ is_active: false }).neq('id', id);
            }
            await sb.from('gacha_banners').update({ is_active: isActive }).eq('id', id);

            showNotification('卡池激活状态已更新', 'success');
            await loadBanners();
            await logAction('修改卡池激活状态', 'gacha_banners', id, '', '激活:' + isActive);
        });
    });
}

// ----- 辅助：解析 up_five_star_list 为显示字符串 -----
function parseUpListForForm(banner) {
    if (banner.up_five_star_list && Array.isArray(banner.up_five_star_list) && banner.up_five_star_list.length > 0) {
        return banner.up_five_star_list.join(', ');
    } else if (banner.up_five_star) {
        // 如果 up_five_star 包含逗号，说明已经是多UP格式
        if (banner.up_five_star.includes(',')) {
            return banner.up_five_star;
        }
        return banner.up_five_star;
    }
    return '';
}

// ----- 添加卡池 -----
export async function addBanner() {
    const html = `
        <div class="form-field"><label>标识(banner_key)</label><input type="text" name="banner_key" required></div>
        <div class="form-field"><label>名称</label><input type="text" name="name" required></div>
        <div class="form-field"><label>副标题</label><input type="text" name="sub_name"></div>
        <div class="form-field"><label>UP五星角色名</label><input type="text" name="up_five_star" placeholder="单UP填一个，复刻用逗号分隔"></div>
        <div class="form-field"><label style="color:#facc15;">⭐ 复刻多UP列表（逗号分隔）</label>
            <input type="text" name="up_five_star_list" placeholder="布洛妮娅, 希儿, 鹿将军" style="border-color:#facc15;">
            <small style="color:var(--text-secondary);">多个UP角色用逗号分隔，会自动保存为数组。优先使用此字段。</small>
        </div>
        <div class="form-field"><label>立绘URL</label><input type="text" name="splash_url"></div>
        <div class="form-field"><label>说明文字</label><input type="text" name="caption"></div>
        <div class="form-field"><label>开始时间</label><input type="datetime-local" name="start_time" required></div>
        <div class="form-field"><label>结束时间</label><input type="datetime-local" name="end_time" required></div>
        <div class="form-field"><label>排序</label><input type="number" name="display_order" value="0"></div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '添加卡池';
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const upListRaw = fd.get('up_five_star_list')?.trim() || '';

        // 解析多UP列表
        let upFiveStarList = [];
        if (upListRaw) {
            upFiveStarList = upListRaw.split(',').map(s => s.trim()).filter(Boolean);
        }

        const data = {
            banner_key: fd.get('banner_key'),
            name: fd.get('name'),
            sub_name: fd.get('sub_name'),
            up_five_star: fd.get('up_five_star') || (upFiveStarList.length > 0 ? upFiveStarList[0] : ''),
            up_five_star_list: upFiveStarList,
            splash_url: fd.get('splash_url'),
            caption: fd.get('caption'),
            start_time: new Date(fd.get('start_time')).toISOString(),
            end_time: new Date(fd.get('end_time')).toISOString(),
            display_order: parseInt(fd.get('display_order')) || 0,
            is_active: false
        };

        try {
            const sb = getSupabase();
            await sb.from('gacha_banners').insert([data]);
            showNotification('卡池已添加', 'success');
            closeModal('genericModal');
            await loadBanners();
            await logAction('添加卡池', 'gacha_banners', '', data.name, JSON.stringify(data));
        } catch (err) {
            showNotification('添加失败: ' + err.message, 'error');
        }
    };
}

// ----- 编辑卡池 -----
window.editBanner = async function (id) {
    const b = currentBanners.find(x => x.id === id);
    if (!b) return;

    // 解析 up_five_star_list 为逗号分隔字符串
    let upListStr = '';
    if (b.up_five_star_list && Array.isArray(b.up_five_star_list) && b.up_five_star_list.length > 0) {
        upListStr = b.up_five_star_list.join(', ');
    } else if (b.up_five_star && b.up_five_star.includes(',')) {
        upListStr = b.up_five_star;
    }

    const html = `
        <div class="form-field"><label>标识(banner_key)</label><input type="text" name="banner_key" value="${escapeHtml(b.banner_key)}" required></div>
        <div class="form-field"><label>名称</label><input type="text" name="name" value="${escapeHtml(b.name)}" required></div>
        <div class="form-field"><label>副标题</label><input type="text" name="sub_name" value="${escapeHtml(b.sub_name || '')}"></div>
        <div class="form-field"><label>UP五星角色名</label><input type="text" name="up_five_star" value="${escapeHtml(b.up_five_star || '')}" placeholder="单UP填一个"></div>
        <div class="form-field"><label style="color:#facc15;">⭐ 复刻多UP列表（逗号分隔）</label>
            <input type="text" name="up_five_star_list" value="${escapeHtml(upListStr)}" placeholder="布洛妮娅, 希儿" style="border-color:#facc15;">
            <small style="color:var(--text-secondary);">多个UP角色用逗号分隔，会自动保存为数组。优先使用此字段。</small>
        </div>
        <div class="form-field"><label>立绘URL</label><input type="text" name="splash_url" value="${escapeHtml(b.splash_url || '')}"></div>
        <div class="form-field"><label>说明文字</label><input type="text" name="caption" value="${escapeHtml(b.caption || '')}"></div>
        <div class="form-field"><label>开始时间</label><input type="datetime-local" name="start_time" value="${b.start_time.slice(0, 16)}"></div>
        <div class="form-field"><label>结束时间</label><input type="datetime-local" name="end_time" value="${b.end_time.slice(0, 16)}"></div>
        <div class="form-field"><label>排序</label><input type="number" name="display_order" value="${b.display_order}"></div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '编辑卡池';
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const upListRaw = fd.get('up_five_star_list')?.trim() || '';

        // 解析多UP列表
        let upFiveStarList = [];
        if (upListRaw) {
            upFiveStarList = upListRaw.split(',').map(s => s.trim()).filter(Boolean);
        }

        const data = {
            banner_key: fd.get('banner_key'),
            name: fd.get('name'),
            sub_name: fd.get('sub_name'),
            up_five_star: fd.get('up_five_star') || (upFiveStarList.length > 0 ? upFiveStarList[0] : ''),
            up_five_star_list: upFiveStarList,
            splash_url: fd.get('splash_url'),
            caption: fd.get('caption'),
            start_time: new Date(fd.get('start_time')).toISOString(),
            end_time: new Date(fd.get('end_time')).toISOString(),
            display_order: parseInt(fd.get('display_order')) || 0
        };

        try {
            const sb = getSupabase();
            await sb.from('gacha_banners').update(data).eq('id', id);
            showNotification('卡池已更新', 'success');
            closeModal('genericModal');
            await loadBanners();
            await logAction('编辑卡池', 'gacha_banners', id, data.name, JSON.stringify(data));
        } catch (err) {
            showNotification('更新失败: ' + err.message, 'error');
        }
    };
};

// ----- 删除卡池 -----
window.deleteBanner = async function (id) {
    if (!confirm('确定删除该卡池吗？')) return;

    try {
        const sb = getSupabase();
        await sb.from('gacha_banners').delete().eq('id', id);
        showNotification('卡池已删除', 'success');
        await loadBanners();
        await logAction('删除卡池', 'gacha_banners', id, '', '');
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};

// ============================================================
// 池子项目管理（常驻五星 / 四星 / 三星）
// ============================================================

// ----- 通用加载 -----
async function loadSimpleTable(tableName, nameField, containerId) {
    const sb = getSupabase();
    const { data } = await sb
        .from(tableName)
        .select('*')
        .order('sort_order');

    renderSimpleTable(containerId, data || [], nameField, tableName);
    return data || [];
}

function renderSimpleTable(containerId, data, nameField, tableName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.length) {
        container.innerHTML = '<div class="empty-data">暂无数据，点击添加</div>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>名称</th>
                    <th>排序</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const item of data) {
        html += `
            <tr>
                <td>${escapeHtml(item[nameField])}</td>
                <td>${item.sort_order}</td>
                <td class="action-buttons">
                    <button class="edit-btn" onclick="window.editSimpleItem('${tableName}', ${item.id}, '${nameField}', '${escapeHtml(item[nameField])}', ${item.sort_order})">
                        编辑
                    </button>
                    <button class="delete-btn" onclick="window.deleteSimpleItem('${tableName}', ${item.id})">
                        删除
                    </button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ----- 通用添加 -----
export function addSimpleItem(tableName, nameField) {
    const html = `
        <div class="form-field"><label>名称</label><input type="text" name="name" required></div>
        <div class="form-field"><label>排序</label><input type="number" name="sort_order" value="0"></div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '添加项目';
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            [nameField]: fd.get('name'),
            sort_order: parseInt(fd.get('sort_order')) || 0
        };

        try {
            const sb = getSupabase();
            await sb.from(tableName).insert([data]);
            showNotification('添加成功', 'success');
            closeModal('genericModal');
            await loadAllGachaTables();
            await logAction('添加抽卡池项目', tableName, '', data[nameField], JSON.stringify(data));
        } catch (err) {
            showNotification('添加失败: ' + err.message, 'error');
        }
    };
}

// ----- 通用编辑 -----
window.editSimpleItem = async function (tableName, id, nameField, currentName, currentOrder) {
    const html = `
        <div class="form-field"><label>名称</label><input type="text" name="name" value="${escapeHtml(currentName)}" required></div>
        <div class="form-field"><label>排序</label><input type="number" name="sort_order" value="${currentOrder}"></div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '编辑项目';
    document.getElementById('modalFields').innerHTML = html;

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            [nameField]: fd.get('name'),
            sort_order: parseInt(fd.get('sort_order')) || 0
        };

        try {
            const sb = getSupabase();
            await sb.from(tableName).update(data).eq('id', id);
            showNotification('更新成功', 'success');
            closeModal('genericModal');
            await loadAllGachaTables();
            await logAction('编辑抽卡池项目', tableName, id, data[nameField], JSON.stringify(data));
        } catch (err) {
            showNotification('更新失败: ' + err.message, 'error');
        }
    };
};

// ----- 通用删除 -----
window.deleteSimpleItem = async function (tableName, id) {
    if (!confirm('确定删除吗？')) return;

    try {
        const sb = getSupabase();
        await sb.from(tableName).delete().eq('id', id);
        showNotification('删除成功', 'success');
        await loadAllGachaTables();
        await logAction('删除抽卡池项目', tableName, id, '', '');
    } catch (err) {
        showNotification('删除失败: ' + err.message, 'error');
    }
};

// ----- 加载所有池子 -----
export async function loadPermFive() {
    await loadSimpleTable('gacha_permanent_five', 'character_name', 'permFiveListArea');
}

export async function loadFourStar() {
    await loadSimpleTable('gacha_four_star', 'character_name', 'fourStarListArea');
}

export async function loadThreeStar() {
    await loadSimpleTable('gacha_three_star', 'item_name', 'threeStarListArea');
}

export async function loadAllGachaTables() {
    await Promise.all([loadPermFive(), loadFourStar(), loadThreeStar()]);
}

// ============================================================
// 全局概率配置
// ============================================================

export async function loadGachaConfig() {
    const sb = getSupabase();
    const { data } = await sb.from('gacha_config').select('*').single();

    if (!data) return;

    const html = `
        <div class="asset-item">基础四星概率: <input type="number" id="cfg_base_rate" step="0.001" value="${data.base_rate_4}"></div>
        <div class="asset-item">五星保底: <input type="number" id="cfg_pity5" value="${data.pity_5_max}"></div>
        <div class="asset-item">四星保底: <input type="number" id="cfg_pity4" value="${data.pity_4_max}"></div>
        <div class="asset-item">软保底起始: <input type="number" id="cfg_soft" value="${data.soft_pity_start}"></div>
        <div class="asset-item">满命五星补偿: <input type="number" id="cfg_comp5" value="${data.compensation_5_overflow}"></div>
        <div class="asset-item">满命四星补偿: <input type="number" id="cfg_comp4" value="${data.compensation_4_overflow}"></div>
        <div class="asset-item">兑换比例: <input type="number" id="cfg_exchange" value="${data.exchange_rate}"></div>
    `;

    document.getElementById('configArea').innerHTML = html;
}

export async function saveGachaConfig() {
    const updates = {
        base_rate_4: parseFloat(document.getElementById('cfg_base_rate').value),
        pity_5_max: parseInt(document.getElementById('cfg_pity5').value),
        pity_4_max: parseInt(document.getElementById('cfg_pity4').value),
        soft_pity_start: parseInt(document.getElementById('cfg_soft').value),
        compensation_5_overflow: parseInt(document.getElementById('cfg_comp5').value),
        compensation_4_overflow: parseInt(document.getElementById('cfg_comp4').value),
        exchange_rate: parseInt(document.getElementById('cfg_exchange').value),
        updated_at: new Date().toISOString()
    };

    try {
        const sb = getSupabase();
        await sb.from('gacha_config').update(updates).eq('id', 1);
        showNotification('全局配置已保存', 'success');
        await logAction('修改抽卡全局配置', 'gacha_config', '1', 'system', JSON.stringify(updates));
    } catch (err) {
        showNotification('保存失败: ' + err.message, 'error');
    }
}