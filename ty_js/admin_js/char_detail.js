// ========== 角色详情编辑器（纯文本编辑 + 子模态框 + 精确滚动恢复 + 字符串ID） ==========
import { getSupabase } from './auth.js';
import { showNotification, logAction, openModal, closeModal, escapeHtml } from './utils.js';

let currentEditCharId = null;
let currentEditCharData = null;
let expandedSections = {};
let savedScrollRatio = 0;

const ALL_SKILL_KEYS = [
    'normal', 'skill', 'ultimate', 'talent',
    'enhanced_normal', 'enhanced_skill', 'enhanced_ultimate',
    'memetic_skill', 'memetic_talent'
];

const DEFAULT_SKILL_TEMPLATE = {
    name: '技能名',
    maxLevel: 10,
    desc: '技能描述，用 【高亮】 标记高亮，用 {数值ID} 引用下方数值',
    details: [{ label: '示例', value: '示例值' }],
    values: [{ id: 'val1', base: 100, step: 10, suffix: '%' }]
};

// ============================================================
// 标记转换工具（纯文本 ↔ HTML）
// ============================================================
function htmlToMarkdown(html) {
    if (!html) return '';
    let text = html;
    text = text.replace(/<span class="const-val">([^<]*)<\/span>/g, '【$1】');
    text = text.replace(/<span id="([^"]+)"[^>]*>([^<]*)<\/span>/g, '{$1}');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/\n\s*\n/g, '\n\n');
    return text.trim();
}

function markdownToHtml(markdown, values) {
    if (!markdown) return '';
    let html = markdown;
    html = html.replace(/【([^】]+)】/g, '<span class="const-val">$1</span>');
    html = html.replace(/\{([^}]+)\}/g, (match, id) => {
        const valObj = (values || []).find(v => v.id === id);
        const display = valObj ? `${valObj.base}${valObj.suffix || ''}` : match;
        return `<span id="${id}" class="skill-val">${display}</span>`;
    });
    html = html.replace(/\n/g, '<br>');
    return html;
}

function parseEffectTemplate(rawText) {
    if (!rawText) return '';
    return rawText.replace(/【([^】]+)】/g, '<span class="const-val">$1</span>');
}

function unparseEffectTemplate(htmlText) {
    if (!htmlText) return '';
    let text = htmlText.replace(/<span class="const-val">([^<]*)<\/span>/g, '【$1】');
    text = text.replace(/<[^>]+>/g, '');
    return text;
}

// ============================================================
// 主入口（加载数据并转换标记）
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
            const skills = data.skills || {};
            Object.keys(skills).forEach(key => {
                const skill = skills[key];
                if (skill && skill.desc) {
                    skill.desc = htmlToMarkdown(skill.desc);
                }
            });
            const extraAbilities = (data.extra_abilities || []).map(item => ({
                ...item,
                desc: htmlToMarkdown(item.desc || '')
            }));
            const constellations = (data.constellations || []).map(item => ({
                ...item,
                effect: htmlToMarkdown(item.effect || '')
            }));

            currentEditCharData = {
                ...data,
                id: data.id,
                base_stats: data.base_stats || { hp: 0, atk: 0, def: 0, spd: 100, energy: 100 },
                trace_stats: data.trace_stats || [],
                extra_abilities: extraAbilities,
                constellations: constellations,
                skills: skills,
                promotion_stages: data.promotion_stages || [],
                teams: data.teams || [],
                image_url: data.image_url || ''
            };
        }

        ALL_SKILL_KEYS.forEach(key => {
            if (!currentEditCharData.skills[key]) {
                currentEditCharData.skills[key] = {};
            }
        });

        currentEditCharId = charId;
        expandedSections = {};
        savedScrollRatio = 0;
        renderDetailEditor();
    } catch (err) {
        showNotification('加载角色详情失败: ' + err.message, 'error');
    }
}

// ============================================================
// 判断技能是否有数据
// ============================================================
function isSkillPopulated(sk) {
    if (!sk) return false;
    if (sk.name && sk.name.trim() !== '') return true;
    if (sk.desc && sk.desc.trim() !== '') return true;
    if (sk.values && sk.values.length > 0) return true;
    if (sk.details && sk.details.length > 0) return true;
    return false;
}

// ============================================================
// 渲染主界面（修复滚动：使用专属容器ID）
// ============================================================
function renderDetailEditor() {
    const d = currentEditCharData;
    if (!d) {
        document.getElementById('modalFields').innerHTML = '<p style="color:red;">数据加载失败，请重新打开</p>';
        return;
    }

    // ★ 获取滚动容器（使用专属ID）
    const scrollContainer = document.getElementById('detailScrollContainer');
    if (scrollContainer) {
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScroll > 0) {
            savedScrollRatio = scrollContainer.scrollTop / maxScroll;
        } else {
            savedScrollRatio = 0;
        }
    }

    const skills = d.skills || {};
    const skillKeys = ALL_SKILL_KEYS;

    // ---- 技能列表 ----
    let skillsListHtml = '';
    for (const key of skillKeys) {
        const sk = skills[key] || {};
        const isPopulated = isSkillPopulated(sk);
        const statusLabel = isPopulated ? '✅ 已配置' : '🟡 空占位';
        const statusColor = isPopulated ? '#4ade80' : 'var(--text-secondary)';
        const isExpanded = expandedSections[`skill_${key}`] || false;

        skillsListHtml += `
            <div class="skill-item" style="border:1px solid ${isPopulated ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}; border-radius:8px; margin-bottom:8px; overflow:hidden;">
                <div onclick="window._toggleSkill('${key}')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; cursor:pointer; background:rgba(255,255,255,0.03);">
                    <div>
                        <strong style="color:${isPopulated ? '#E8C96B' : 'var(--text-secondary)'};">${escapeHtml(key)}</strong>
                        <span style="font-size:0.8rem; margin-left:12px; color:${statusColor};">${statusLabel}</span>
                        ${isPopulated ? `<span style="font-size:0.7rem; color:var(--text-secondary); margin-left:8px;">Lv.${sk.maxLevel || 10}</span>` : ''}
                        ${isPopulated && sk.name ? `<span style="font-size:0.7rem; color:var(--text-secondary); margin-left:8px;">${escapeHtml(sk.name)}</span>` : ''}
                    </div>
                    <div>
                        <span style="font-size:0.8rem; color:var(--text-secondary); margin-right:8px;">${isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                        ${isPopulated ? `<button type="button" class="delete-btn" onclick="event.stopPropagation(); window._clearSkill('${key}')" style="padding:2px 10px; font-size:0.7rem;">清空</button>` : ''}
                        ${!isPopulated ? `<button type="button" class="edit-btn" onclick="event.stopPropagation(); window._populateSkill('${key}')" style="padding:2px 10px; font-size:0.7rem;">填充模板</button>` : ''}
                    </div>
                </div>
                ${isExpanded ? renderSkillDetail(key, sk) : ''}
            </div>
        `;
    }

    // ---- 行迹加成 ----
    const traceList = d.trace_stats || [];
    let traceHtml = traceList.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.85rem;">暂无行迹</p>' :
        traceList.map((item, i) => `
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                <input type="text" class="trace-label" value="${escapeHtml(item.label || '')}" placeholder="标签" style="flex:1; min-width:80px;">
                <input type="text" class="trace-value" value="${escapeHtml(item.value || '')}" placeholder="数值" style="flex:1; min-width:60px;">
                <input type="text" class="trace-icon" value="${escapeHtml(item.icon || '')}" placeholder="图标文件名" style="flex:1; min-width:80px;">
                <button type="button" class="delete-btn" onclick="window._removeTrace(${i})" style="padding:2px 10px; font-size:0.7rem;">✕</button>
            </div>
        `).join('');

    // ---- 额外能力 ----
    const extraList = d.extra_abilities || [];
    let extraHtml = extraList.length === 0 ? '<p style="color:var(--text-secondary); font-size:0.85rem;">暂无额外能力</p>' :
        extraList.map((item, i) => `
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                <input type="text" class="extra-name" value="${escapeHtml(item.name || '')}" placeholder="能力名" style="flex:1; min-width:80px;">
                <textarea class="extra-desc" rows="2" placeholder="用 【数字】 高亮显示" style="flex:2; min-width:120px; resize:vertical; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:4px 6px; color:#ccc;">${escapeHtml(item.desc || '')}</textarea>
                <button type="button" class="delete-btn" onclick="window._removeExtra(${i})" style="padding:2px 10px; font-size:0.7rem;">✕</button>
            </div>
        `).join('');

    // ---- 星魂 ----
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

    // ---- 配队 ----
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

    // ---- 晋级材料 ----
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

    // ---- 完整 HTML（★ 添加 id="detailScrollContainer" ★） ----
    const html = `
        <div id="detailScrollContainer" style="max-height:70vh; overflow-y:auto; padding-right:4px;">

            <!-- 基础信息 -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📋 基础信息</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div class="form-field"><label>角色ID（不可改）</label><input type="text" id="charDetail_id" value="${escapeHtml(d.id)}" disabled style="opacity:0.6;"></div>
                    <div class="form-field"><label>角色名</label><input type="text" id="charDetail_name" value="${escapeHtml(d.name)}"></div>
                    <div class="form-field" style="grid-column:span 2;"><label>立绘URL</label><input type="text" id="charDetail_image" value="${escapeHtml(d.image_url)}" placeholder="https://..."></div>
                </div>
            </div>

            <!-- 基础属性 -->
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

            <!-- 行迹加成 -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">📈 行迹加成</h4>
                <div id="trace-list">${traceHtml}</div>
                <button type="button" class="add-btn" onclick="window._addTrace()" style="padding:4px 16px; font-size:0.8rem; margin-top:6px;">
                    <i class="fas fa-plus"></i> 添加行迹
                </button>
            </div>

            <!-- 额外能力 -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">✨ 额外能力</h4>
                <div id="extra-list">${extraHtml}</div>
                <button type="button" class="add-btn" onclick="window._addExtra()" style="padding:4px 16px; font-size:0.8rem; margin-top:6px;">
                    <i class="fas fa-plus"></i> 添加能力
                </button>
            </div>

            <!-- 技能 -->
            <div class="form-section" style="margin-bottom:16px;">
                <h4 style="color:#E8C96B; margin-bottom:8px;">⚔️ 技能（9个固定位）</h4>
                <div id="skillsEditArea">${skillsListHtml}</div>
            </div>

            <!-- 星魂 -->
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

            <!-- 配队 -->
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

            <!-- 晋级材料 -->
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

    const modal = document.getElementById('genericModal');
    const isAlreadyOpen = modal && modal.classList.contains('show');

    if (!isAlreadyOpen) {
        openModal('genericModal');
    }

    document.getElementById('modalTitle').innerText = `📝 编辑角色详情 - ${d.name}`;
    document.getElementById('modalFields').innerHTML = html;
    document.getElementById('modalSubmitBtn').innerText = '💾 保存全部';

    // ★ 恢复滚动（使用专属容器）
    const restoredContainer = document.getElementById('detailScrollContainer');
    if (restoredContainer && savedScrollRatio > 0) {
        // 双重延迟确保布局完成
        setTimeout(() => {
            const maxScroll = restoredContainer.scrollHeight - restoredContainer.clientHeight;
            if (maxScroll > 0) {
                restoredContainer.scrollTop = Math.min(Math.round(savedScrollRatio * maxScroll), maxScroll);
            }
        }, 50);
        requestAnimationFrame(() => {
            const maxScroll = restoredContainer.scrollHeight - restoredContainer.clientHeight;
            if (maxScroll > 0) {
                restoredContainer.scrollTop = Math.min(Math.round(savedScrollRatio * maxScroll), maxScroll);
            }
        });
    }

    document.getElementById('modalForm').onsubmit = async (e) => {
        e.preventDefault();
        await saveDetailEditor();
    };
}

// ============================================================
// 渲染技能详情（纯文本编辑，带标记提示）
// ============================================================
function renderSkillDetail(key, sk) {
    if (!isSkillPopulated(sk)) {
        return `
            <div style="padding:12px 16px; background:rgba(255,255,255,0.02); color:var(--text-secondary);">
                空占位，点击「填充模板」快速生成
            </div>
        `;
    }

    const detailsStr = (sk.details || []).map(d => `${d.label}:${d.value}`).join('\n');
    const valuesStr = (sk.values || []).map(v => `${v.id},${v.base},${v.step},${v.suffix||''}`).join('\n');

    const tip = `
        <div style="font-size:0.75rem; color:var(--text-secondary); background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:4px; margin-bottom:6px;">
            💡 纯文本编辑：<strong>【文字】</strong> 高亮显示 · <strong>{数值ID}</strong> 引用下方数值（如 {skill-val1}）
        </div>
    `;

    return `
        <div style="padding:12px 16px; background:rgba(255,255,255,0.03); border-top:1px solid rgba(255,255,255,0.05);">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-field"><label>技能名</label><input type="text" id="sk_name_${key}" value="${escapeHtml(sk.name || '')}"></div>
                <div class="form-field"><label>最大等级</label><input type="number" id="sk_max_${key}" value="${sk.maxLevel || 10}"></div>
                <div class="form-field" style="grid-column:span 2;">
                    <label>描述（纯文本，支持标记）</label>
                    ${tip}
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
// 保存全部（转换标记为HTML）
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

        const traceStats = [];
        document.querySelectorAll('#trace-list > div').forEach(row => {
            const label = row.querySelector('.trace-label')?.value?.trim();
            const value = row.querySelector('.trace-value')?.value?.trim();
            const icon = row.querySelector('.trace-icon')?.value?.trim();
            if (label || value || icon) {
                traceStats.push({ label: label || '', value: value || '', icon: icon || '' });
            }
        });

        const extraAbilities = [];
        document.querySelectorAll('#extra-list > div').forEach(row => {
            const nameVal = row.querySelector('.extra-name')?.value?.trim();
            const desc = row.querySelector('.extra-desc')?.value?.trim();
            if (nameVal || desc) {
                extraAbilities.push({ 
                    name: nameVal || '', 
                    desc: markdownToHtml(desc || '', []) 
                });
            }
        });

        const skills = {};
        Object.keys(currentEditCharData.skills).forEach(key => {
            const sk = currentEditCharData.skills[key];
            if (sk) {
                const desc = document.getElementById(`sk_desc_${key}`)?.value;
                if (desc !== undefined) {
                    const values = sk.values || [];
                    sk.desc = markdownToHtml(desc, values);
                }
                skills[key] = sk;
            }
        });

        const constellations = (currentEditCharData.constellations || []).map(c => ({
            ...c,
            effect: markdownToHtml(c.effect || '', [])
        }));

        const updateData = {
            id: currentEditCharId,
            name,
            base_stats: { hp, atk, def, spd, energy },
            trace_stats: traceStats,
            extra_abilities: extraAbilities,
            constellations: constellations,
            skills: skills,
            promotion_stages: currentEditCharData.promotion_stages || [],
            teams: currentEditCharData.teams || [],
            image_url: imageUrl,
            updated_at: new Date().toISOString()
        };

        const sb = getSupabase();
        const { error } = await sb
            .from('character_details')
            .upsert(updateData, { onConflict: 'id' });

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
// 行迹操作
// ============================================================
window._addTrace = function() {
    const container = document.getElementById('trace-list');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;';
    div.innerHTML = `
        <input type="text" class="trace-label" placeholder="标签（如：暴击伤害）" style="flex:1; min-width:80px;">
        <input type="text" class="trace-value" placeholder="数值（如：36%）" style="flex:1; min-width:60px;">
        <input type="text" class="trace-icon" placeholder="图标文件名" style="flex:1; min-width:80px;">
        <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 10px; font-size:0.7rem;">✕</button>
    `;
    container.appendChild(div);
};

window._removeTrace = function(index) {
    const rows = document.querySelectorAll('#trace-list > div');
    if (rows[index]) rows[index].remove();
};

// ============================================================
// 额外能力操作
// ============================================================
window._addExtra = function() {
    const container = document.getElementById('extra-list');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;';
    div.innerHTML = `
        <input type="text" class="extra-name" placeholder="能力名" style="flex:1; min-width:80px;">
        <textarea class="extra-desc" rows="2" placeholder="用 【数字】 高亮显示" style="flex:2; min-width:120px; resize:vertical; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:4px 6px; color:#ccc;"></textarea>
        <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 10px; font-size:0.7rem;">✕</button>
    `;
    container.appendChild(div);
};

window._removeExtra = function(index) {
    const rows = document.querySelectorAll('#extra-list > div');
    if (rows[index]) rows[index].remove();
};

// ============================================================
// 技能操作
// ============================================================
window._toggleSkill = function(key) {
    expandedSections[`skill_${key}`] = !expandedSections[`skill_${key}`];
    renderDetailEditor();
};

window._populateSkill = function(key) {
    currentEditCharData.skills[key] = JSON.parse(JSON.stringify(DEFAULT_SKILL_TEMPLATE));
    expandedSections[`skill_${key}`] = true;
    renderDetailEditor();
};

window._saveSkill = function(key) {
    try {
        const sk = currentEditCharData.skills[key];
        if (!sk) {
            showNotification('技能数据未初始化', 'error');
            return;
        }

        const name = document.getElementById(`sk_name_${key}`).value.trim();
        const maxLevel = parseInt(document.getElementById(`sk_max_${key}`).value) || 10;
        const descRaw = document.getElementById(`sk_desc_${key}`).value;
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

        const desc = markdownToHtml(descRaw, values);

        currentEditCharData.skills[key] = { name, maxLevel, desc, details, values };
        showNotification('技能已保存', 'success');
        renderDetailEditor();
    } catch (err) {
        showNotification('保存技能失败: ' + err.message, 'error');
    }
};

window._clearSkill = function(key) {
    if (!confirm(`确定清空「${key}」技能数据吗？`)) return;
    currentEditCharData.skills[key] = {};
    renderDetailEditor();
};

// ============================================================
// ★★★★★ 星魂操作（子模态框） ★★★★★
// ============================================================
window._addCons = function() {
    const html = `
        <div class="form-field"><label>层数（如 1命）</label><input type="text" id="cons_level" placeholder="1命"></div>
        <div class="form-field"><label>名称</label><input type="text" id="cons_name" placeholder="疾风追影"></div>
        <div class="form-field">
            <label>效果描述</label>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">
                💡 用 <strong>【数字+单位】</strong> 标记高亮，如：<code>【20%】</code>
            </div>
            <textarea id="cons_effect" rows="3" placeholder="攻击敌方目标时，若该敌方目标当前生命值≥当前生命上限的【20%】，则该敌方目标受到的伤害提高【50%】。" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:#ccc; font-size:0.9rem; resize:vertical;"></textarea>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
                📌 预览效果：<span id="consPreview" style="color:#E8C96B;">等待输入...</span>
            </div>
        </div>
    `;
    openModal('subModal');
    document.getElementById('subModalTitle').innerText = '添加星魂';
    document.getElementById('subModalFields').innerHTML = html;

    const textarea = document.getElementById('cons_effect');
    const preview = document.getElementById('consPreview');
    if (textarea && preview) {
        textarea.oninput = function() {
            preview.innerHTML = parseEffectTemplate(this.value) || '等待输入...';
        };
    }

    document.getElementById('subModalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const level = document.getElementById('cons_level').value.trim();
            const name = document.getElementById('cons_name').value.trim();
            const rawEffect = document.getElementById('cons_effect').value;
            if (!level || !name) { showNotification('层数和名称不能为空', 'error'); return; }
            if (!currentEditCharData.constellations) currentEditCharData.constellations = [];
            currentEditCharData.constellations.push({
                level,
                name,
                effect: rawEffect
            });
            closeModal('subModal');
            renderDetailEditor();
            showNotification('星魂已添加', 'success');
        } catch (err) {
            showNotification('添加星魂失败: ' + err.message, 'error');
        }
    };
};

window._editCons = function(index) {
    try {
        const cons = currentEditCharData.constellations;
        if (!cons || !Array.isArray(cons) || index < 0 || index >= cons.length) {
            showNotification('未找到要编辑的星魂', 'error');
            return;
        }
        const c = cons[index];
        if (!c) {
            showNotification('星魂数据无效', 'error');
            return;
        }

        const effectMarkdown = c.effect && c.effect.includes('<span') ? unparseEffectTemplate(c.effect) : c.effect;

        const html = `
            <div class="form-field"><label>层数</label><input type="text" id="cons_level" value="${escapeHtml(c.level)}"></div>
            <div class="form-field"><label>名称</label><input type="text" id="cons_name" value="${escapeHtml(c.name)}"></div>
            <div class="form-field">
                <label>效果描述</label>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">
                    💡 用 <strong>【数字+单位】</strong> 标记高亮
                </div>
                <textarea id="cons_effect" rows="3" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:#ccc; font-size:0.9rem; resize:vertical;">${escapeHtml(effectMarkdown)}</textarea>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
                    📌 预览效果：<span id="consPreview" style="color:#E8C96B;">${escapeHtml(c.effect || '等待输入...')}</span>
                </div>
            </div>
        `;
        openModal('subModal');
        document.getElementById('subModalTitle').innerText = '编辑星魂';
        document.getElementById('subModalFields').innerHTML = html;

        const textarea = document.getElementById('cons_effect');
        const preview = document.getElementById('consPreview');
        if (textarea && preview) {
            textarea.oninput = function() {
                preview.innerHTML = parseEffectTemplate(this.value) || '等待输入...';
            };
        }

        document.getElementById('subModalForm').onsubmit = (e) => {
            e.preventDefault();
            try {
                const rawEffect = document.getElementById('cons_effect').value;
                const newLevel = document.getElementById('cons_level').value.trim();
                const newName = document.getElementById('cons_name').value.trim();
                if (!newLevel || !newName) {
                    showNotification('层数和名称不能为空', 'error');
                    return;
                }
                currentEditCharData.constellations[index] = {
                    level: newLevel,
                    name: newName,
                    effect: rawEffect
                };
                closeModal('subModal');
                renderDetailEditor();
                showNotification('星魂已更新', 'success');
            } catch (err) {
                showNotification('更新星魂失败: ' + err.message, 'error');
            }
        };
    } catch (err) {
        showNotification('编辑星魂出错: ' + err.message, 'error');
    }
};

window._removeCons = function(index) {
    if (!confirm('删除这条星魂？')) return;
    try {
        if (!Array.isArray(currentEditCharData.constellations) || index < 0 || index >= currentEditCharData.constellations.length) {
            showNotification('无效的索引', 'error');
            return;
        }
        currentEditCharData.constellations.splice(index, 1);
        renderDetailEditor();
        showNotification('星魂已删除', 'success');
    } catch (err) {
        showNotification('删除星魂失败: ' + err.message, 'error');
    }
};

// ============================================================
// ★★★★★ 配队操作（子模态框） ★★★★★
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
        <div class="form-field"><label>角色列表（纯文本表单）</label>
            <div id="teamRolesContainer">
                <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
                    <input type="text" class="tr-char" placeholder="角色名" style="flex:1; min-width:80px;">
                    <input type="text" class="tr-role" placeholder="定位（主C/辅）" style="flex:1; min-width:60px;">
                    <input type="text" class="tr-initial" placeholder="缩写" style="flex:1; min-width:50px;">
                    <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
                </div>
            </div>
            <button type="button" class="add-btn" onclick="addTeamRoleRow()" style="padding:2px 12px; font-size:0.7rem; margin-top:4px;">
                <i class="fas fa-plus"></i> 添加角色
            </button>
        </div>
    `;
    openModal('subModal');
    document.getElementById('subModalTitle').innerText = '添加配队';
    document.getElementById('subModalFields').innerHTML = html;

    window.addTeamRoleRow = function() {
        const container = document.getElementById('teamRolesContainer');
        if (!container) return;
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;';
        div.innerHTML = `
            <input type="text" class="tr-char" placeholder="角色名" style="flex:1; min-width:80px;">
            <input type="text" class="tr-role" placeholder="定位（主C/辅）" style="flex:1; min-width:60px;">
            <input type="text" class="tr-initial" placeholder="缩写" style="flex:1; min-width:50px;">
            <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
        `;
        container.appendChild(div);
    };

    document.getElementById('subModalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const roles = [];
            document.querySelectorAll('#teamRolesContainer > div').forEach(row => {
                const char = row.querySelector('.tr-char')?.value?.trim();
                const role = row.querySelector('.tr-role')?.value?.trim();
                const initial = row.querySelector('.tr-initial')?.value?.trim();
                if (char) {
                    roles.push({ char, role: role || '辅', initial: initial || char.charAt(0) });
                }
            });
            if (roles.length === 0) { showNotification('至少添加一个角色', 'error'); return; }

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
            closeModal('subModal');
            renderDetailEditor();
            showNotification('配队已添加', 'success');
        } catch (err) {
            showNotification('添加配队失败: ' + err.message, 'error');
        }
    };
};

window._editTeam = function(index) {
    try {
        const teams = currentEditCharData.teams;
        if (!teams || !Array.isArray(teams) || index < 0 || index >= teams.length) {
            showNotification('未找到要编辑的配队', 'error');
            return;
        }
        const t = teams[index];
        if (!t) {
            showNotification('配队数据无效', 'error');
            return;
        }

        let rolesHtml = '';
        (t.roles || []).forEach(r => {
            rolesHtml += `
                <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
                    <input type="text" class="tr-char" value="${escapeHtml(r.char || '')}" placeholder="角色名" style="flex:1; min-width:80px;">
                    <input type="text" class="tr-role" value="${escapeHtml(r.role || '')}" placeholder="定位" style="flex:1; min-width:60px;">
                    <input type="text" class="tr-initial" value="${escapeHtml(r.initial || '')}" placeholder="缩写" style="flex:1; min-width:50px;">
                    <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
                </div>
            `;
        });

        const html = `
            <div class="form-field"><label>图标</label><input type="text" id="team_icon" value="${escapeHtml(t.icon || '')}"></div>
            <div class="form-field"><label>名称</label><input type="text" id="team_name" value="${escapeHtml(t.name)}"></div>
            <div class="form-field"><label>描述</label><input type="text" id="team_desc" value="${escapeHtml(t.desc || '')}"></div>
            <div class="form-field"><label>核心</label><input type="text" id="team_core" value="${escapeHtml(t.core || '')}"></div>
            <div class="form-field"><label>生存</label><input type="text" id="team_survival" value="${escapeHtml(t.survival || '')}"></div>
            <div class="form-field"><label>光锥</label><input type="text" id="team_lightcone" value="${escapeHtml(t.lightcone || '')}"></div>
            <div class="form-field"><label>遗器</label><input type="text" id="team_relic" value="${escapeHtml(t.relic || '')}"></div>
            <div class="form-field"><label>角色列表</label>
                <div id="teamRolesContainer">${rolesHtml}</div>
                <button type="button" class="add-btn" onclick="addTeamRoleRow()" style="padding:2px 12px; font-size:0.7rem; margin-top:4px;">
                    <i class="fas fa-plus"></i> 添加角色
                </button>
            </div>
        `;
        openModal('subModal');
        document.getElementById('subModalTitle').innerText = '编辑配队';
        document.getElementById('subModalFields').innerHTML = html;

        window.addTeamRoleRow = function() {
            const container = document.getElementById('teamRolesContainer');
            if (!container) return;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="tr-char" placeholder="角色名" style="flex:1; min-width:80px;">
                <input type="text" class="tr-role" placeholder="定位" style="flex:1; min-width:60px;">
                <input type="text" class="tr-initial" placeholder="缩写" style="flex:1; min-width:50px;">
                <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
            `;
            container.appendChild(div);
        };

        document.getElementById('subModalForm').onsubmit = (e) => {
            e.preventDefault();
            try {
                const roles = [];
                document.querySelectorAll('#teamRolesContainer > div').forEach(row => {
                    const char = row.querySelector('.tr-char')?.value?.trim();
                    const role = row.querySelector('.tr-role')?.value?.trim();
                    const initial = row.querySelector('.tr-initial')?.value?.trim();
                    if (char) {
                        roles.push({ char, role: role || '辅', initial: initial || char.charAt(0) });
                    }
                });
                if (roles.length === 0) { showNotification('至少添加一个角色', 'error'); return; }

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
                closeModal('subModal');
                renderDetailEditor();
                showNotification('配队已更新', 'success');
            } catch (err) {
                showNotification('更新配队失败: ' + err.message, 'error');
            }
        };
    } catch (err) {
        showNotification('编辑配队出错: ' + err.message, 'error');
    }
};

window._removeTeam = function(index) {
    if (!confirm('删除这条配队？')) return;
    try {
        if (!Array.isArray(currentEditCharData.teams) || index < 0 || index >= currentEditCharData.teams.length) {
            showNotification('无效的索引', 'error');
            return;
        }
        currentEditCharData.teams.splice(index, 1);
        renderDetailEditor();
        showNotification('配队已删除', 'success');
    } catch (err) {
        showNotification('删除配队失败: ' + err.message, 'error');
    }
};

// ============================================================
// ★★★★★ 晋级材料操作（子模态框） ★★★★★
// ============================================================
window._addStage = function() {
    const html = `
        <div class="form-field"><label>目标等级</label><input type="number" id="stage_level" placeholder="20"></div>
        <div class="form-field"><label>材料列表（纯文本表单）</label>
            <div id="stageMatsContainer">
                <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
                    <input type="text" class="sm-key" placeholder="材料key（如 sugar）" style="flex:1; min-width:80px;">
                    <input type="number" class="sm-count" placeholder="数量" style="flex:1; min-width:60px;">
                    <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
                </div>
            </div>
            <button type="button" class="add-btn" onclick="addStageMatRow()" style="padding:2px 12px; font-size:0.7rem; margin-top:4px;">
                <i class="fas fa-plus"></i> 添加材料
            </button>
        </div>
    `;
    openModal('subModal');
    document.getElementById('subModalTitle').innerText = '添加晋级阶段';
    document.getElementById('subModalFields').innerHTML = html;

    window.addStageMatRow = function() {
        const container = document.getElementById('stageMatsContainer');
        if (!container) return;
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;';
        div.innerHTML = `
            <input type="text" class="sm-key" placeholder="材料key" style="flex:1; min-width:80px;">
            <input type="number" class="sm-count" placeholder="数量" style="flex:1; min-width:60px;">
            <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
        `;
        container.appendChild(div);
    };

    document.getElementById('subModalForm').onsubmit = (e) => {
        e.preventDefault();
        try {
            const targetLevel = parseInt(document.getElementById('stage_level').value);
            if (isNaN(targetLevel) || targetLevel <= 0) throw new Error('请输入有效等级');
            const materials = [];
            document.querySelectorAll('#stageMatsContainer > div').forEach(row => {
                const key = row.querySelector('.sm-key')?.value?.trim();
                const count = parseInt(row.querySelector('.sm-count')?.value);
                if (key && count > 0) {
                    materials.push({ key, count });
                }
            });
            if (materials.length === 0) throw new Error('至少添加一种材料');

            if (!currentEditCharData.promotion_stages) currentEditCharData.promotion_stages = [];
            currentEditCharData.promotion_stages.push({ targetLevel, materials });
            currentEditCharData.promotion_stages.sort((a, b) => a.targetLevel - b.targetLevel);
            closeModal('subModal');
            renderDetailEditor();
            showNotification('晋级阶段已添加', 'success');
        } catch (err) {
            showNotification('错误: ' + err.message, 'error');
        }
    };
};

window._editStage = function(index) {
    try {
        const stages = currentEditCharData.promotion_stages;
        if (!stages || !Array.isArray(stages) || index < 0 || index >= stages.length) {
            showNotification('未找到要编辑的晋级阶段', 'error');
            return;
        }
        const s = stages[index];
        if (!s) {
            showNotification('晋级阶段数据无效', 'error');
            return;
        }

        let matsHtml = '';
        (s.materials || []).forEach(m => {
            matsHtml += `
                <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
                    <input type="text" class="sm-key" value="${escapeHtml(m.key)}" placeholder="材料key" style="flex:1; min-width:80px;">
                    <input type="number" class="sm-count" value="${m.count}" placeholder="数量" style="flex:1; min-width:60px;">
                    <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
                </div>
            `;
        });

        const html = `
            <div class="form-field"><label>目标等级</label><input type="number" id="stage_level" value="${s.targetLevel}"></div>
            <div class="form-field"><label>材料列表</label>
                <div id="stageMatsContainer">${matsHtml}</div>
                <button type="button" class="add-btn" onclick="addStageMatRow()" style="padding:2px 12px; font-size:0.7rem; margin-top:4px;">
                    <i class="fas fa-plus"></i> 添加材料
                </button>
            </div>
        `;
        openModal('subModal');
        document.getElementById('subModalTitle').innerText = '编辑晋级阶段';
        document.getElementById('subModalFields').innerHTML = html;

        window.addStageMatRow = function() {
            const container = document.getElementById('stageMatsContainer');
            if (!container) return;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;';
            div.innerHTML = `
                <input type="text" class="sm-key" placeholder="材料key" style="flex:1; min-width:80px;">
                <input type="number" class="sm-count" placeholder="数量" style="flex:1; min-width:60px;">
                <button type="button" class="delete-btn" onclick="this.parentElement.remove()" style="padding:2px 8px; font-size:0.7rem;">✕</button>
            `;
            container.appendChild(div);
        };

        document.getElementById('subModalForm').onsubmit = (e) => {
            e.preventDefault();
            try {
                const targetLevel = parseInt(document.getElementById('stage_level').value);
                if (isNaN(targetLevel) || targetLevel <= 0) throw new Error('请输入有效等级');
                const materials = [];
                document.querySelectorAll('#stageMatsContainer > div').forEach(row => {
                    const key = row.querySelector('.sm-key')?.value?.trim();
                    const count = parseInt(row.querySelector('.sm-count')?.value);
                    if (key && count > 0) {
                        materials.push({ key, count });
                    }
                });
                if (materials.length === 0) throw new Error('至少添加一种材料');
                currentEditCharData.promotion_stages[index] = { targetLevel, materials };
                currentEditCharData.promotion_stages.sort((a, b) => a.targetLevel - b.targetLevel);
                closeModal('subModal');
                renderDetailEditor();
                showNotification('晋级阶段已更新', 'success');
            } catch (err) {
                showNotification('错误: ' + err.message, 'error');
            }
        };
    } catch (err) {
        showNotification('编辑晋级阶段出错: ' + err.message, 'error');
    }
};

window._removeStage = function(index) {
    if (!confirm('删除这个晋级阶段？')) return;
    try {
        if (!Array.isArray(currentEditCharData.promotion_stages) || index < 0 || index >= currentEditCharData.promotion_stages.length) {
            showNotification('无效的索引', 'error');
            return;
        }
        currentEditCharData.promotion_stages.splice(index, 1);
        renderDetailEditor();
        showNotification('晋级阶段已删除', 'success');
    } catch (err) {
        showNotification('删除晋级阶段失败: ' + err.message, 'error');
    }
};