// info-popup.js - 角色/敌人信息弹窗（四标签页切换，技能顺序固定，数值橙色高亮，套装详细）

function renderStatusList(list) {
    if (!list || list.length === 0) return '<div style="color:#aaa;">无</div>';
    return list.map(s => `<div class="status-item">${s.name || s}</div>`).join('');
}

// 获取当前装备的遗器列表
function getEquippedRelics() {
    const saved = localStorage.getItem('hsr-relic-equips');
    if (!saved) return [];
    try {
        const equips = JSON.parse(saved);
        const parts = ['head', 'hands', 'body', 'feet', 'sphere', 'rope'];
        const partNames = { head:'智慧头套', hands:'指挥手套', body:'安心的护甲', feet:'健步如飞的靴子', sphere:'过去的球', rope:'过去的绳' };
        const relics = [];
        for (let part of parts) {
            const relic = equips[part];
            if (relic && relic.mainStat && relic.mainStat.type) {
                relics.push({
                    part: partNames[part],
                    set: relic.setType || '未知套装',
                    level: relic.level || 0,
                    mainStat: `${getStatName(relic.mainStat.type)} ${formatStatValue(relic.mainStat.type, relic.mainStat.value)}`,
                    subStats: (relic.subStats || []).map(sub => `${getStatName(sub.type)} ${formatStatValue(sub.type, sub.value)}${sub.enhanceCount ? ` (强化${sub.enhanceCount}次)` : ''}`)
                });
            }
        }
        return relics;
    } catch(e) { return []; }
}

// 属性名称映射
function getStatName(type) {
    const map = {
        hpPercent:'生命%', atkPercent:'攻击%', defPercent:'防御%', critRate:'暴击率', critDamage:'暴击伤害',
        speed:'速度', effectHitRate:'效果命中', effectRes:'效果抵抗', energyRegen:'能量回复',
        windDamage:'风属性伤害提高', fireDamage:'火属性伤害提高', iceDamage:'冰属性伤害提高', imaginaryDamage:'虚数属性伤害提高',
        physicalDamage:'物理属性伤害提高', quantumDamage:'量子属性伤害提高', hp:'生命', atk:'攻击', def:'防御'
    };
    return map[type] || type;
}

function formatStatValue(type, value) {
    const percentTypes = ['hpPercent','atkPercent','defPercent','critRate','critDamage','effectHitRate','effectRes','energyRegen','windDamage','fireDamage','iceDamage','imaginaryDamage','physicalDamage','quantumDamage'];
    return percentTypes.includes(type) ? `${value}%` : `${value}`;
}

// 橙色高亮数值
function highlightNumbers(str) {
    return str.replace(/(\d+(?:\.\d+)?%)/g, '<span class="golden">$1</span>');
}

// 技能详情HTML（固定顺序：普攻、战技、终结技、天赋；动态数值橙色高亮）
function renderSkillsDetail(skills) {
    if (!skills || skills.length === 0) return '<div style="color:#aaa;">无技能信息</div>';
    // 固定顺序
    const order = ['normal', 'skill', 'ultimate', 'talent'];
    const nameMap = { normal:'普攻', skill:'战技', ultimate:'终结技', talent:'天赋' };
    const sorted = [];
    for (let type of order) {
        const skill = skills.find(s => s.type === type);
        if (skill) sorted.push(skill);
    }
    return sorted.map(skill => {
        let desc = skill.description || '暂无描述';
        // 替换占位符并转换为橙色高亮数值
        if (skill.baseDamage) desc = desc.replace('{damage}', `<span class="golden">${Math.round(skill.baseDamage*100)}%</span>`);
        if (skill.extraDamage) desc = desc.replace('{extra}', `<span class="golden">${Math.round(skill.extraDamage*100)}%</span>`);
        if (skill.type === 'talent') {
            if (skill.penetration !== undefined) desc = desc.replace('{penetration}', `<span class="golden">${Math.round(skill.penetration*100)}%</span>`);
            if (skill.atkBonus !== undefined) desc = desc.replace('{atkBonus}', `<span class="golden">${Math.round(skill.atkBonus*100)}%</span>`);
        }
        // 额外处理可能未通过变量替换的纯数字百分比
        desc = highlightNumbers(desc);
        const levelInfo = `Lv.${skill.currentLevel} / ${skill.maxLevel}`;
        return `
            <div class="skill-detail-item">
                <div class="skill-detail-header">
                    <span class="skill-detail-name">${skill.icon || '✨'} ${skill.name}</span>
                    <span class="skill-detail-level">${levelInfo}</span>
                </div>
                <div class="skill-detail-desc">${desc}</div>
            </div>
        `;
    }).join('');
}

// 获取详细套装效果文本（换行）
function getDetailedSetEffects(setCounts) {
    const lines = [];
    const future = setCounts["新生的未来"] || 0;
    const past = setCounts["过往的旧事物"] || 0;
    if (future >= 2) {
        lines.push("• 【新生的未来】2件套：暴击率提高8%");
        if (future >= 4) {
            lines.push("• 【新生的未来】4件套：装备者攻击力≥1800后，每增加200攻击，使装备者暴击伤害提高15%，最多提高60%");
        }
    }
    if (past >= 2) {
        lines.push("• 【过往的旧事物】2件套：若装备者速度≥115/140/160，则造成的伤害提高10%/15%/25%");
    }
    if (lines.length === 0) return null;
    return lines.join('<br>');
}

// 角色详情弹窗（四标签页切换）
function showCharacterInfo(characterIndex) {
    const char = window.getCharacterDataForPopup ? window.getCharacterDataForPopup() : null;
    if (!char) return;

    const imgStyle = 'width:20px; height:20px; vertical-align:middle; margin-right:6px;';

    // ---- 标签页1：角色面板 ----
    const statsHtml = `
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/HP.webp" style="${imgStyle}">生命值</span><span class="stat-value">${char.hp} / ${char.maxHp}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/ATK.webp" style="${imgStyle}">攻击力</span><span class="stat-value">${char.attack}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/DEF.webp" style="${imgStyle}">防御力</span><span class="stat-value">${char.defense}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/SPD.webp" style="${imgStyle}">速度</span><span class="stat-value">${char.speed}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/IconCriticalChance.webp" style="${imgStyle}">暴击率</span><span class="stat-value">${Math.round((char.critRate || 0.05)*100)}%</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/IconCriticalDamage.webp" style="${imgStyle}">暴击伤害</span><span class="stat-value">${Math.round((char.critDamage || 0.5)*100)}%</span></div>
    `;
    const activatedTraces = char._activatedTraces || [];
    let traceHtml = '';
    if (activatedTraces.length) {
        const traceNames = { luguan_talent1:'疾风守护', luguan_talent2:'精准狩猎', luguan_talent3:'风速迅捷' };
        const activeTraceNames = activatedTraces.map(id => traceNames[id] || id).join('、');
        traceHtml = `<div class="trace-status">🌿 激活行迹：${activeTraceNames}</div>`;
    }

    // ---- 标签页2：遗器装备 ----
    const equippedRelics = getEquippedRelics();
    let relicsHtml = '';
    if (equippedRelics.length === 0) {
        relicsHtml = '<div style="color:#aaa;">未穿戴遗器</div>';
    } else {
        relicsHtml = equippedRelics.map(relic => `
            <div class="relic-detail-item">
                <div class="relic-detail-header">${relic.part} · ${relic.set} +${relic.level}</div>
                <div class="relic-detail-main">✨ ${relic.mainStat}</div>
                <div class="relic-detail-subs">${relic.subStats.map(s => `• ${s}`).join('<br>')}</div>
            </div>
        `).join('');
    }
    const setCounts = char.relicSetCounts || {};
    const setEffectText = getDetailedSetEffects(setCounts);
    let setEffectHtml = '';
    if (setEffectText) {
        setEffectHtml = `<div class="set-effect">🎯 套装效果：<br>${setEffectText}</div>`;
    }

    // ---- 标签页3：技能详情 ----
    const skillsHtml = renderSkillsDetail(char.skills);

    // ---- 标签页4：星魂同调 ----
    const activatedEidolons = char.activatedEidolons || [];
    let eidolonHtml = '';
    if (activatedEidolons.length > 0) {
        const eidolonNames = {};
        if (window.GameData && window.GameData.eidolons) {
            for (let [id, data] of Object.entries(window.GameData.eidolons)) eidolonNames[id] = data.name;
        } else {
            const fallback = { e1:'疾风追影', e2:'旋刃狩魂', e3:'裂空破障', e4:'破晓狩风', e5:'风狩铭纹', e6:'逐影风刃' };
            Object.assign(eidolonNames, fallback);
        }
        const items = activatedEidolons.map(id => `<div class="status-item">${eidolonNames[id] || id.toUpperCase()}</div>`).join('');
        eidolonHtml = `<div class="status-list">${items}</div>`;
    } else {
        eidolonHtml = '<div style="color:#aaa;">无激活命座</div>';
    }

    // ---- 构建模态框（四标签页）----
    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card expanded">
            <div class="info-header">
                <h3>${char.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            <div class="info-tabs">
                <button class="info-tab-btn active" data-tab="tab1">📊 角色面板</button>
                <button class="info-tab-btn" data-tab="tab2">📿 遗器装备</button>
                <button class="info-tab-btn" data-tab="tab3">✨ 技能详情</button>
                <button class="info-tab-btn" data-tab="tab4">🌟 星魂同调</button>
            </div>
            <div class="info-tab-contents">
                <div class="info-tab-pane active" id="tab1-pane">
                    <div class="section-content">${statsHtml}${traceHtml}</div>
                </div>
                <div class="info-tab-pane" id="tab2-pane">
                    <div class="section-content">${relicsHtml}${setEffectHtml}</div>
                </div>
                <div class="info-tab-pane" id="tab3-pane">
                    <div class="section-content skill-detail-list">${skillsHtml}</div>
                </div>
                <div class="info-tab-pane" id="tab4-pane">
                    <div class="section-content">${eidolonHtml}</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    // 标签页切换逻辑
    const tabs = modal.querySelectorAll('.info-tab-btn');
    const panes = modal.querySelectorAll('.info-tab-pane');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            panes.forEach(pane => pane.classList.remove('active'));
            const activePane = modal.querySelector(`#${tabId}-pane`);
            if (activePane) activePane.classList.add('active');
        });
    });
    modal.querySelector('.close-info').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// 敌人详情弹窗（保持简洁）
function showEnemyInfo(enemyIndex) {
    const enemy = window.getEnemyDataForPopup ? window.getEnemyDataForPopup(enemyIndex) : null;
    if (!enemy) return;

    const imgStyle = 'width:20px; height:20px; vertical-align:middle; margin-right:6px;';
    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <h3>${enemy.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            <div class="stat-row"><span class="stat-label"><img src="/attribute_image/HP.webp" style="${imgStyle}">生命值</span><span class="stat-value">${enemy.hp} / ${enemy.maxHp}</span></div>
            <div class="stat-row"><span class="stat-label"><img src="/attribute_image/ATK.webp" style="${imgStyle}">攻击力</span><span class="stat-value">${enemy.attack}</span></div>
            <div class="stat-row"><span class="stat-label"><img src="/attribute_image/DEF.webp" style="${imgStyle}">防御力</span><span class="stat-value">${enemy.defense}</span></div>
            <div class="stat-row"><span class="stat-label"><img src="/attribute_image/SPD.webp" style="${imgStyle}">速度</span><span class="stat-value">${enemy.speed || '??'}</span></div>
            <div class="status-section">
                <div class="status-title">⚠️ 负面状态</div>
                <div class="status-list" id="debuff-list">${renderStatusList(enemy.debuffs || [])}</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-info').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}