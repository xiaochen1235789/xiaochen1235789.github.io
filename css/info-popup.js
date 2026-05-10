// info-popup.js - 角色/敌人信息弹窗，含命座显示、光锥信息、正负面状态、遗器套装效果

function renderStatusList(list) {
    if (!list || list.length === 0) return '<div style="color:#aaa;">无</div>';
    return list.map(s => `<div class="status-item">${s.name || s}</div>`).join('');
}

// 显示角色详情弹窗（五个板块：角色信息、光锥信息、遗器套装效果、星魂同调、正负面状态）
function showCharacterInfo(characterIndex) {
    const char = window.getCharacterDataForPopup ? window.getCharacterDataForPopup() : null;
    if (!char) return;

    const imgStyle = 'width:20px; height:20px; vertical-align:middle; margin-right:6px;';

    // ---- 1. 角色信息 ----
    const statsHtml = `
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/HP.webp" style="${imgStyle}">生命值</span><span class="stat-value">${char.hp} / ${char.maxHp}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/ATK.webp" style="${imgStyle}">攻击力</span><span class="stat-value">${char.attack}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/DEF.webp" style="${imgStyle}">防御力</span><span class="stat-value">${char.defense}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/SPD.webp" style="${imgStyle}">速度</span><span class="stat-value">${char.speed}</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/IconCriticalChance.webp" style="${imgStyle}">暴击率</span><span class="stat-value">${Math.round((char.critRate || 0.05)*100)}%</span></div>
        <div class="stat-row"><span class="stat-label"><img src="/attribute_image/IconCriticalDamage.webp" style="${imgStyle}">暴击伤害</span><span class="stat-value">${Math.round((char.critDamage || 0.5)*100)}%</span></div>
    `;

    // ---- 2. 光锥信息 ----
    let lightconeHtml = '';
    const lcInfo = char._lightconeInfo;
    if (lcInfo && lcInfo.name) {
        const superimposeRoman = ['①','②','③','④','⑤'][lcInfo.superimpose-1];
        lightconeHtml = `
            <div class="status-section">
                <div class="status-title">📖 光锥 · ${lcInfo.name}</div>
                <div class="status-list">Lv.${lcInfo.level} | 叠影${superimposeRoman}</div>
                <div style="margin-top:6px; font-size:0.75rem; color:#ccc;">${lcInfo.desc || '效果描述'}</div>
            </div>
        `;
    } else {
        lightconeHtml = `<div class="status-section"><div class="status-title">📖 光锥</div><div class="status-list">未装备</div></div>`;
    }

    // ---- 3. 遗器套装效果 ----
    let relicHtml = '';
    const setCount = char.relicSetCounts || {};
    if (Object.keys(setCount).length > 0) {
        const parts = [];
        if (setCount["新生的未来"] >= 2) parts.push(`新生的未来 2件: 暴击率+8%`);
        if (setCount["新生的未来"] >= 4) {
            const cond = { minAtk: 1800, step: 200, bonusPerStep: 0.15, maxBonus: 0.6 };
            let overAtk = Math.max(0, char.attack - cond.minAtk);
            let steps = Math.floor(overAtk / cond.step);
            let bonus = Math.min(cond.maxBonus, steps * cond.bonusPerStep);
            parts.push(`新生的未来 4件: 暴击伤害+${(bonus * 100).toFixed(0)}% (基于攻击力)`);
        }
        if (setCount["过往的旧事物"] >= 2) {
            const thresholds = [115, 140, 160];
            const bonuses = [0.10, 0.15, 0.25];
            let speedBonus = 0;
            for (let i = 0; i < thresholds.length; i++) {
                if (char.speed >= thresholds[i]) speedBonus = bonuses[i];
            }
            parts.push(`过往的旧事物 2件: 造成的伤害提高${(speedBonus * 100).toFixed(0)}% (速度 ${char.speed})`);
        }
        if (parts.length > 0) {
            relicHtml = `
                <div class="status-section">
                    <div class="status-title">📿 遗器套装效果</div>
                    <div class="status-list">${parts.map(p => `<div class="status-item">${p}</div>`).join('')}</div>
                </div>
            `;
        } else {
            relicHtml = `<div class="status-section"><div class="status-title">📿 遗器套装效果</div><div class="status-list">无激活套装</div></div>`;
        }
    } else {
        relicHtml = `<div class="status-section"><div class="status-title">📿 遗器套装效果</div><div class="status-list">未检测到套装</div></div>`;
    }

    // ---- 4. 星魂同调 ----
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
        eidolonHtml = `<div class="status-section"><div class="status-title">🌟 星魂同调</div><div class="status-list">${items}</div></div>`;
    } else {
        eidolonHtml = `<div class="status-section"><div class="status-title">🌟 星魂同调</div><div class="status-list">无激活命座</div></div>`;
    }

    // ---- 5. 正面/负面状态 ----
    const buffHtml = `<div class="status-section"><div class="status-title">✨ 正面状态</div><div class="status-list">${renderStatusList(char.buffs || [])}</div></div>`;
    const debuffHtml = `<div class="status-section"><div class="status-title">⚠️ 负面状态</div><div class="status-list">${renderStatusList(char.debuffs || [])}</div></div>`;

    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <h3>${char.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            ${statsHtml}
            ${lightconeHtml}
            ${relicHtml}
            ${eidolonHtml}
            ${buffHtml}
            ${debuffHtml}
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-info').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// 显示敌人详情弹窗（保持简洁）
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