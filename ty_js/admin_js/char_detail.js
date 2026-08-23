// ========== 角色详情编辑器（折叠卡片版，清爽整洁） ==========
import { getSupabase } from './auth.js';
import { showNotification, logAction, openModal, closeModal, escapeHtml } from './utils.js';

let currentEditCharId = null;
let currentEditCharData = null;
let expandedSections = {}; // 记录展开状态

const DEFAULT_SKILL_TEMPLATE = {
    name: '技能名',
    maxLevel: 10,
    desc: '技能描述',
    details: [{ label: '示例', value: '示例值' }],
    values: [{ id: 'val1', base: 100, step: 10, suffix: '%' }]
};

// ============================================================
// 主入口
// ============================================================
export async function openCharDetailEditor(charId) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('character_details')
            .select('*')
            .eq('id', charId)
            .single();

        if (error && error.code === 'PGRST116') {
            currentEditCharData = {
                id: charId,
                name: '未命名',
                base_stats: { hp: 0, atk: 0, def: 0, spd: 100, energy: 100 },
                trace_stats: [],
                extra_abilities: [],
                constellations: [],
                skills: {},
                promotion_stages: [],
                teams: [],
                image_url: ''
            };
        } else if (error) {
            throw error;
        } else {
            currentEditCharData = {
                ...data,
                base_stats: data.base_stats || { hp: 0, atk: 0, def: 0, spd: 100, energy: 100 },
                trace_stats: data.trace_stats || [],
                extra_abilities: data.extra_abilities || [],
                constellations: data.constellations || [],
                skills: data.skills || {},
                promotion_stages: data.promotion_stages || [],
                teams: data.teams || [],
                image_url: data.image_url || ''
            };
        }

        currentEditCharId = charId;
        expandedSections = {};
        renderDetailEditor();
    } catch (err) {
        showNotification('加载角色详情失败: ' + err.message, 'error');
    }
}

// ============================================================
// 渲染主界面（折叠卡片版）
// ============================================================
function renderDetailEditor() {
    const d = currentEditCharData;
    const skills = d.skills || {};
    const skillKeys = Object.keys(skills);

    // ---- 技能列表（折叠卡片） ----
    let skillsListHtml = '';
    if (skillKeys.length === 0) {
        skillsListHtml = `<p style="color:var(--text-secondary); font-size:0.9rem;">暂无技能，点下方「添加技能键」创建</p>`;
    } else {
        for (const key of skillKeys) {
            const sk = skills[key] || {};
            const isPlaceholder = Object.keys(sk).length === 0;
            const statusLabel = isPlaceholder ? '🟡 空占位' : '✅ 已配置';
            const statusColor = isPlaceholder ? 'var(--text-secondary)' : '#4ade80';
            const isExpanded = expandedSections[`skill_${key}`] || false;

            skillsListHtml += `
                <div class="skill-item" style="border:1px solid ${isPlaceholder ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.2)'}; border-radius:8px; margin-bottom:8px; overflow:hidden;">
                    <div onclick="window._toggleSkill('${key}')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; cursor:pointer; background:rgba(255,255,255,0.03);">
                        <div>
                            <strong style="color:${isPlaceholder ? 'var(--text-secondary)' : '#E8C96B'};">${escapeHtml(key)}</strong>
                            <span style="font-size:0.8rem; margin-left:12px; color:${statusColor};">${statusLabel}</span>
                            ${!isPlaceholder ? `<span style="font-size:0.7rem; color:var(--text-secondary); margin-left:8px;">Lv.${sk.maxLevel || 10}</span>` : ''}
                        </div>
                        <div>
                            <span style="font-size:0.8rem; color:var(--text-secondary); margin-right:8px;">${isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                            ${!isPlaceholder ? `<button type="button" class="delete-btn" onclick="event.stopPropagation(); window._clearSkill('${key}')" style="padding:2px 10px; font-size:0.7rem;">清空</button>` : ''}
                            ${isPlaceholder ? `<button type="button" class="edit-btn" onclick="event.stopPropagation(); window._populateSkill('${key}')" style="padding:2px 10px; font-size:0.7rem;">填充</button>` : ''}
                        </div>
                    </div>
                    ${isExpanded ? renderSkillDetail(key, sk) : ''}
                </div>
            `;
        }
    }

    // ---- 星魂列表 ----
    const cons = d.constellations || [];
    let consListHtml = cons.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.9rem;">暂无星魂</p>' :
        cons.map((c, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span><strong>${escapeHtml(c.level)}</strong> ${escapeHtml(c.name)}</span>
                <div>
                    <button class="edit-btn" onclick="window._editCons(${i})" style="padding:2px 10px; font-size:0.7rem;">编辑</button>
                    <button class="delete-btn" onclick="window._removeCons(${i})" style="padding:2px 10px; font-size:0.7rem;">✕</button>
                </div>
            </div>
        `).join('');

    // ---- 配队列表 ----
    const teams = d.teams || [];
    let teamsListHtml = teams.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.9rem;">暂无配队</p>' :
        teams.map((t, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span><strong>${escapeHtml(t.icon || '')} ${escapeHtml(t.name)}</strong> ${escapeHtml(t.desc || '')}</span>
                <div>
                    <button class="edit-btn" onclick="window._editTeam(${i})" style="padding:2px 10px; font-size:0.7rem;">编辑</button>
                    <button class="delete-btn" onclick="window._removeTeam(${i})" style="padding:2px 10px; font-size:0.7rem;">✕</button>
                </div>
            </div>
        `).join('');

    // ---- 晋级材料列表 ----
    const stages = d.promotion_stages || [];
    let stagesListHtml = stages.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.9rem;">暂无晋级阶段</p>' :
        stages.map((s, i) => {
            const matsStr = (s.materials || []).map(m => `${m.key}×${m.count}`).join(', ');
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span>Lv.${s.targetLevel} → ${escapeHtml(matsStr)}</span>
                    <div>
                        <button class="edit-btn" onclick="window._editStage(${i})" style="padding:2px 10px; font-size:0.7rem;">编辑</button>
                        <button class="delete-btn" onclick="window._removeStage(${i})" style="padding:2px 10px; font-size:0.7rem;">✕</button>
                    </div>
                </div>
            `;
        }).join('');

    // ---- 完整 HTML ----
    const html = `
        <div style="max-height:70vh; overflow-y:auto; padding-right:4px;">

            <!-- ===== 基础信息 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📋 基础信息</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div class="form-field"><label>角色ID（不可改）</label><input type="text" id="charDetail_id" value="${escapeHtml(d.id)}" disabled style="opacity:0.6;"></div>
                    <div class="form-field"><label>角色名</label><input type="text" id="charDetail_name" value="${escapeHtml(d.name)}"></div>
                    <div class="form-field" style="grid-column:span 2;"><label>立绘URL</label><input type="text" id="charDetail_image" value="${escapeHtml(d.image_url)}" placeholder="https://..."></div>
                </div>
            </div>

            <!-- ===== 基础属性 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📊 基础属性</h4>
                <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px;">
                    <div class="form-field"><label>HP</label><input type="number" id="base_hp" value="${d.base_stats.hp || 0}"></div>
                    <div class="form-field"><label>攻击</label><input type="number" id="base_atk" value="${d.base_stats.atk || 0}"></div>
                    <div class="form-field"><label>防御</label><input type="number" id="base_def" value="${d.base_stats.def || 0}"></div>
                    <div class="form-field"><label>速度</label><input type="number" id="base_spd" value="${d.base_stats.spd || 100}"></div>
                    <div class="form-field"><label>能量</label><input type="number" id="base_energy" value="${d.base_stats.energy || 100}"></div>
                </div>
            </div>

            <!-- ===== 行迹加成 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📈 行迹加成（JSON）</h4>
                <textarea id="charDetail_trace" rows="2" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:#ccc; font-size:0.85rem;">${JSON.stringify(d.trace_stats || [], null, 2)}</textarea>
            </div>

            <!-- ===== 额外能力 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">✨ 额外能力（JSON）</h4>
                <textarea id="charDetail_extra" rows="2" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:#ccc; font-size:0.85rem;">${JSON.stringify(d.extra_abilities || [], null, 2)}</textarea>
            </div>

            <!-- ===== 技能 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">⚔️ 技能</h4>
                <div style="margin-bottom:8px;">
                    <button type="button" class="add-btn" onclick="window._addSkillKey()" style="padding:4px 16px; font-size:0.85rem;">
                        <i class="fas fa-plus"></i> 添加技能键
                    </button>
                    <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:8px;">${skillKeys.length} 个技能</span>
                </div>
                <div id="skillsEditArea">${skillsListHtml}</div>
            </div>

            <!-- ===== 星魂 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">⭐ 星魂</h4>
                <div style="margin-bottom:8px;">
                    <button type="button" class="add-btn" onclick="window._addCons()" style="padding:4px 16px; font-size:0.85rem;">
                        <i class="fas fa-plus"></i> 添加星魂
                    </button>
                    <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:8px;">${cons.length} 个</span>
                </div>
                <div id="consEditArea">${consListHtml}</div>
            </div>

            <!-- ===== 配队 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">🤝 配队</h4>
                <div style="margin-bottom:8px;">
                    <button type="button" class="add-btn" onclick="window._addTeam()" style="padding:4px 16px; font-size:0.85rem;">
                        <i class="fas fa-plus"></i> 添加配队
                    </button>
                    <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:8px;">${teams.length} 个</span>
                </div>
                <div id="teamsEditArea">${teamsListHtml}</div>
            </div>

            <!-- ===== 晋级材料 ===== -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📦 晋级材料</h4>
                <div style="margin-bottom:8px;">
                    <button type="button" class="add-btn" onclick="window._addStage()" style="padding:4px 16px; font-size:0.85rem;">
                        <i class="fas fa-plus"></i> 添加阶段
                    </button>
                    <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:8px;">${stages.length} 个阶段</span>
                </div>
                <div id="stagesEditArea">${stagesListHtml}</div>
            </div>

        </div>
    `;

    openModal('genericModal');
    document.getElementById('modalTitle').innerText = `📝 编辑角色详情 - ${d.name}`;
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalSubmitBtn').innerText = '💾 保存全部';

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        await saveDetailEditor();
    };
}

// ============================================================
// 渲染技能详情（展开后的编辑区）
// ============================================================
function renderSkillDetail(key, sk) {
    if (Object.keys(sk).length === 0) {
        return `
            <div style="padding:12px 16px; background:rgba(255,255,255,0.02); color:var(--text-secondary);">
                空占位，点击「填充」快速生成模板
            </div>
        `;
    }

    const detailsStr = (sk.details || []).map(d => `${d.label}:${d.value}`).join('\n');
    const valuesStr = (sk.values || []).map(v => `${v.id},${v.base},${v.step},${v.suffix||''}`).join('\n');

    return `
        <div style="padding:12px 16px; background:rgba(255,255,255,0.03); border-top:1px solid rgba(255,255,255,0.05);">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-field"><label>技能名</label><input type="text" id="sk_name_${key}" value="${escapeHtml(sk.name || '')}"></div>
                <div class="form-field"><label>最大等级</label><input type="number" id="sk_max_${key}" value="${sk.maxLevel || 10}"></div>
                <div class="form-field" style="grid-column:span 2;"><label>描述（支持HTML）</label>
                    <textarea id="sk_desc_${key}" rows="2" style="width:100%;">${escapeHtml(sk.desc || '')}</textarea>
                </div>
                <div class="form-field" style="grid-column:span 2;"><label>细节（每行 label:value）</label>
                    <textarea id="sk_details_${key}" rows="2" style="width:100%;">${escapeHtml(detailsStr)}</textarea>
                </div>
                <div class="form-field" style="grid-column:span 2;"><label>数值（每行 id,base,step,suffix）</label>
                    <textarea id="sk_values_${key}" rows="2" style="width:100%;">${escapeHtml(valuesStr)}</textarea>
                </div>
            </div>
            <div style="margin-top:8px; display:flex; gap:8px;">
                <button type="button" class="save-btn" onclick="window._saveSkill('${key}')" style="padding:4px 16px; font-size:0.8rem;">
                    <i class="fas fa-save"></i> 保存此技能
                </button>
            </div>
        </div>
    `;
}

// ============================================================
// 保存全部
// ============================================================
async function saveDetailEditor() {
    try {
        const name = document.getElementById('charDetail_name').value.trim();
        const imageUrl = document.getElementById('charDetail_image').value.trim();
        const hp = parseInt(document.getElementById('base_hp').value) || 0;
        const atk = parseInt(document.getElementById('base_atk').value) || 0;
        const def = parseInt(document.getElementById('base_def').value) || 0;
        const spd = parseInt(document.getElementById('base_spd').value) || 100;
        const energy = parseInt(document.getElementById('base_energy').value) || 100;

        let traceStats = [];
        let extraAbilities = [];
        try { traceStats = JSON.parse(document.getElementById('charDetail_trace').value) || []; } catch (e) {}
        try { extraAbilities = JSON.parse(document.getElementById('charDetail_extra').value) || []; } catch (e) {}

        const updateData = {
            name,
            base_stats: { hp, atk, def, spd, energy },
            trace_stats: traceStats,
            extra_abilities: extraAbilities,
            constellations: currentEditCharData.constellations || [],
            skills: currentEditCharData.skills || {},
            promotion_stages: currentEditCharData.promotion_stages || [],
            teams: currentEditCharData.teams || [],
            image_url: imageUrl,
            updated_at: new Date().toISOString()
        };

        const sb = getSupabase();
        const { error } = await sb
            .from('character_details')
            .upsert({ id: currentEditCharId, ...updateData }, { onConflict: 'id' });

        if (error) throw error;

        showNotification('角色详情已保存', 'success');
        await logAction('编辑角色详情', 'character_details', currentEditCharId, name, '更新了完整角色数据');
        closeModal('genericModal');

        if (window._switchTabCallbacks?.characters) {
            window._switchTabCallbacks.characters();
        }
    } catch (err) {
        showNotification('保存失败: ' + err.message, 'error');
    }
}

// ============================================================
// 技能操作（挂载 window）
// ============================================================

window._toggleSkill = function(key) {
    expandedSections[`skill_${key}`] = !expandedSections[`skill_${key}`];
    renderDetailEditor();
};

window._addSkillKey = function() {
    const key = prompt('请输入技能键名（如 enhanced_normal）：');
    if (!key) return;
    if (currentEditCharData.skills[key]) {
        showNotification('技能键已存在', 'error');
        return;
    }
    currentEditCharData.skills[key] = {};
    renderDetailEditor();
};

window._populateSkill = function(key) {
    currentEditCharData.skills[key] = JSON.parse(JSON.stringify(DEFAULT_SKILL_TEMPLATE));
    expandedSections[`skill_${key}`] = true;
    renderDetailEditor();
};

window._saveSkill = function(key) {
    const sk = currentEditCharData.skills[key];
    if (!sk) return;

    const name = document.getElementById(`sk_name_${key}`).value.trim();
    const maxLevel = parseInt(document.getElementById(`sk_max_${key}`).value) || 10;
    const desc = document.getElementById(`sk_desc_${key}`).value;
    const detailsRaw = document.getElementById(`sk_details_${key}`).value;
    const valuesRaw = document.getElementById(`sk_values_${key}`).value;

    const details = detailsRaw.split('\n').filter(Boolean).map(line => {
        const [label, value] = line.split(':').map(s => s.trim());
        return { label: label || '未知', value: value || '' };
    });

    const values = valuesRaw.split('\n').filter(Boolean).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
            id: parts[0] || 'val',
            base: parseFloat(parts[1]) || 0,
            step: parseFloat(parts[2]) || 0,
            suffix: parts[3] || ''
        };
    });

    currentEditCharData.skills[key] = { name, maxLevel, desc, details, values };
    showNotification('技能已保存', 'success');
    renderDetailEditor();
};

window._clearSkill = function(key) {
    if (!confirm(`确定清空「${key}」技能数据吗？`)) return;
    currentEditCharData.skills[key] = {};
    renderDetailEditor();
};

// ============================================================
// 星魂操作
// ============================================================
window._addCons = function() {
    const html = `
        <div class="form-field"><label>层数（如 1命）</label><input type="text" id="cons_level" placeholder="1命"></div>
        <div class="form-field"><label>名称</label><input type="text" id="cons_name" placeholder="疾风追影"></div>
        <div class="form-field"><label>效果（支持HTML）</label><textarea id="cons_effect" rows="2">效果描述</textarea></div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '添加星魂';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        const level = document.getElementById('cons_level').value.trim();
        const name = document.getElementById('cons_name').value.trim();
        const effect = document.getElementById('cons_effect').value;
        if (!level || !name) { showNotification('层数和名称不能为空', 'error'); return; }
        if (!currentEditCharData.constellations) currentEditCharData.constellations = [];
        currentEditCharData.constellations.push({ level, name, effect });
        closeModal('genericModal');
        renderDetailEditor();
        showNotification('星魂已添加', 'success');
    };
};

window._editCons = function(index) {
    const c = currentEditCharData.constellations[index];
    if (!c) return;
    const html = `
        <div class="form-field"><label>层数</label><input type="text" id="cons_level" value="${escapeHtml(c.level)}"></div>
        <div class="form-field"><label>名称</label><input type="text" id="cons_name" value="${escapeHtml(c.name)}"></div>
        <div class="form-field"><label>效果</label><textarea id="cons_effect" rows="2">${escapeHtml(c.effect)}</textarea></div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '编辑星魂';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        currentEditCharData.constellations[index] = {
            level: document.getElementById('cons_level').value.trim(),
            name: document.getElementById('cons_name').value.trim(),
            effect: document.getElementById('cons_effect').value
        };
        closeModal('genericModal');
        renderDetailEditor();
        showNotification('星魂已更新', 'success');
    };
};

window._removeCons = function(index) {
    if (!confirm('删除这条星魂？')) return;
    currentEditCharData.constellations.splice(index, 1);
    renderDetailEditor();
};

// ============================================================
// 配队操作
// ============================================================
window._addTeam = function() {
    const html = `
        <div class="form-field"><label>图标</label><input type="text" id="team_icon" placeholder="🌪️"></div>
        <div class="form-field"><label>名称</label><input type="text" id="team_name" placeholder="风猎追击"></div>
        <div class="form-field"><label>描述</label><input type="text" id="team_desc" placeholder="三保一极致输出"></div>
        <div class="form-field"><label>核心</label><input type="text" id="team_core" placeholder="布洛妮娅拉条..."></div>
        <div class="form-field"><label>生存</label><input type="text" id="team_survival" placeholder="罗刹提供治疗"></div>
        <div class="form-field"><label>光锥</label><input type="text" id="team_lightcone" placeholder="「于夜色中」"></div>
        <div class="form-field"><label>遗器</label><input type="text" id="team_relic" placeholder="风套 + 繁星"></div>
        <div class="form-field"><label>角色列表（JSON）</label>
            <textarea id="team_roles" rows="3">[{"char":"鹿将军","role":"主C","initial":"鹿"}]</textarea>
        </div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '添加配队';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const roles = JSON.parse(document.getElementById('team_roles').value);
            if (!Array.isArray(roles)) throw new Error('角色列表必须是数组');
            const team = {
                id: String(currentEditCharData.teams?.length || 0),
                icon: document.getElementById('team_icon').value.trim() || '🤝',
                name: document.getElementById('team_name').value.trim() || '未命名',
                desc: document.getElementById('team_desc').value.trim(),
                core: document.getElementById('team_core').value.trim(),
                survival: document.getElementById('team_survival').value.trim(),
                lightcone: document.getElementById('team_lightcone').value.trim(),
                relic: document.getElementById('team_relic').value.trim(),
                roles: roles
            };
            if (!currentEditCharData.teams) currentEditCharData.teams = [];
            currentEditCharData.teams.push(team);
            closeModal('genericModal');
            renderDetailEditor();
            showNotification('配队已添加', 'success');
        } catch (err) {
            showNotification('角色列表JSON格式错误: ' + err.message, 'error');
        }
    };
};

window._editTeam = function(index) {
    const t = currentEditCharData.teams[index];
    if (!t) return;
    const rolesStr = JSON.stringify(t.roles || [], null, 2);
    const html = `
        <div class="form-field"><label>图标</label><input type="text" id="team_icon" value="${escapeHtml(t.icon || '')}"></div>
        <div class="form-field"><label>名称</label><input type="text" id="team_name" value="${escapeHtml(t.name)}"></div>
        <div class="form-field"><label>描述</label><input type="text" id="team_desc" value="${escapeHtml(t.desc || '')}"></div>
        <div class="form-field"><label>核心</label><input type="text" id="team_core" value="${escapeHtml(t.core || '')}"></div>
        <div class="form-field"><label>生存</label><input type="text" id="team_survival" value="${escapeHtml(t.survival || '')}"></div>
        <div class="form-field"><label>光锥</label><input type="text" id="team_lightcone" value="${escapeHtml(t.lightcone || '')}"></div>
        <div class="form-field"><label>遗器</label><input type="text" id="team_relic" value="${escapeHtml(t.relic || '')}"></div>
        <div class="form-field"><label>角色列表（JSON）</label>
            <textarea id="team_roles" rows="3">${escapeHtml(rolesStr)}</textarea>
        </div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '编辑配队';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const roles = JSON.parse(document.getElementById('team_roles').value);
            if (!Array.isArray(roles)) throw new Error('角色列表必须是数组');
            currentEditCharData.teams[index] = {
                id: String(index),
                icon: document.getElementById('team_icon').value.trim() || '🤝',
                name: document.getElementById('team_name').value.trim(),
                desc: document.getElementById('team_desc').value.trim(),
                core: document.getElementById('team_core').value.trim(),
                survival: document.getElementById('team_survival').value.trim(),
                lightcone: document.getElementById('team_lightcone').value.trim(),
                relic: document.getElementById('team_relic').value.trim(),
                roles: roles
            };
            closeModal('genericModal');
            renderDetailEditor();
            showNotification('配队已更新', 'success');
        } catch (err) {
            showNotification('角色列表JSON格式错误: ' + err.message, 'error');
        }
    };
};

window._removeTeam = function(index) {
    if (!confirm('删除这条配队？')) return;
    currentEditCharData.teams.splice(index, 1);
    renderDetailEditor();
};

// ============================================================
// 晋级材料操作
// ============================================================
window._addStage = function() {
    const html = `
        <div class="form-field"><label>目标等级</label><input type="number" id="stage_level" placeholder="20"></div>
        <div class="form-field"><label>材料列表（JSON）</label>
            <textarea id="stage_mats" rows="3">[{"key":"sugar","count":4000}]</textarea>
        </div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '添加晋级阶段';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const targetLevel = parseInt(document.getElementById('stage_level').value);
            if (isNaN(targetLevel) || targetLevel <= 0) throw new Error('请输入有效等级');
            const materials = JSON.parse(document.getElementById('stage_mats').value);
            if (!Array.isArray(materials)) throw new Error('材料必须是数组');
            if (!currentEditCharData.promotion_stages) currentEditCharData.promotion_stages = [];
            currentEditCharData.promotion_stages.push({ targetLevel, materials });
            currentEditCharData.promotion_stages.sort((a, b) => a.targetLevel - b.targetLevel);
            closeModal('genericModal');
            renderDetailEditor();
            showNotification('晋级阶段已添加', 'success');
        } catch (err) {
            showNotification('错误: ' + err.message, 'error');
        }
    };
};

window._editStage = function(index) {
    const s = currentEditCharData.promotion_stages[index];
    if (!s) return;
    const matsStr = JSON.stringify(s.materials || [], null, 2);
    const html = `
        <div class="form-field"><label>目标等级</label><input type="number" id="stage_level" value="${s.targetLevel}"></div>
        <div class="form-field"><label>材料列表（JSON）</label>
            <textarea id="stage_mats" rows="3">${escapeHtml(matsStr)}</textarea>
        </div>
    `;
    openModal('genericModal');
    document.getElementById('modalTitle').innerText = '编辑晋级阶段';
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const targetLevel = parseInt(document.getElementById('stage_level').value);
            if (isNaN(targetLevel) || targetLevel <= 0) throw new Error('请输入有效等级');
            const materials = JSON.parse(document.getElementById('stage_mats').value);
            if (!Array.isArray(materials)) throw new Error('材料必须是数组');
            currentEditCharData.promotion_stages[index] = { targetLevel, materials };
            currentEditCharData.promotion_stages.sort((a, b) => a.targetLevel - b.targetLevel);
            closeModal('genericModal');
            renderDetailEditor();
            showNotification('晋级阶段已更新', 'success');
        } catch (err) {
            showNotification('错误: ' + err.message, 'error');
        }
    };
};

window._removeStage = function(index) {
    if (!confirm('删除这个晋级阶段？')) return;
    currentEditCharData.promotion_stages.splice(index, 1);
    renderDetailEditor();
};