// info-popup.js - 角色/敌人信息弹窗，含命座显示

// 工具函数：渲染状态列表
function renderStatusList(list) {
    if (!list || list.length === 0) return '<div style="color:#aaa;">无</div>';
    return list.map(s => `<div class="status-item">${s.name || s}</div>`).join('');
}

// 显示角色详情弹窗（含命座，属性图标用真实图片）
function showCharacterInfo(characterIndex) {
    const char = window.getCharacterDataForPopup ? window.getCharacterDataForPopup() : null;
    if (!char) return;

    // 获取命座名称映射
    const eidolonNames = {};
    if (window.GameData && window.GameData.eidolons) {
        for (let [id, data] of Object.entries(window.GameData.eidolons)) {
            eidolonNames[id] = data.name;
        }
    } else {
        const fallback = {
            e1: '疾风追影', e2: '旋刃狩魂', e3: '裂空破障',
            e4: '破晓狩风', e5: '风狩铭纹', e6: '逐影风刃'
        };
        Object.assign(eidolonNames, fallback);
    }

    const activatedEidolons = char.activatedEidolons || [];
    let eidolonHtml = '';
    if (activatedEidolons.length > 0) {
        const items = activatedEidolons.map(id => {
            const name = eidolonNames[id] || id.toUpperCase();
            return `<div class="status-item">${name}</div>`;
        }).join('');
        eidolonHtml = `
            <div class="status-section">
                <div class="status-title">🌟 已激活命座</div>
                <div class="status-list">${items}</div>
            </div>
        `;
    } else {
        eidolonHtml = `
            <div class="status-section">
                <div class="status-title">🌟 命座</div>
                <div class="status-list"><div style="color:#aaa;">无激活命座</div></div>
            </div>
        `;
    }

    // 图片样式辅助
    const imgStyle = 'width:20px; height:20px; vertical-align:middle; margin-right:6px;';

    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <h3>${char.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/HP.webp" style="${imgStyle}" alt="生命">生命值</span>
                <span class="stat-value">${char.hp} / ${char.maxHp}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/ATK.webp" style="${imgStyle}" alt="攻击">攻击力</span>
                <span class="stat-value">${char.attack}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/def.webp" style="${imgStyle}" alt="防御">防御力</span>
                <span class="stat-value">${char.defense}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/SPD.webp" style="${imgStyle}" alt="速度">速度</span>
                <span class="stat-value">${char.speed}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/IconCriticalChance.webp" style="${imgStyle}" alt="暴击率">暴击率</span>
                <span class="stat-value">${Math.round((char.critRate || 0.05)*100)}%</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/IconCriticalDamage.webp" style="${imgStyle}" alt="暴击伤害">暴击伤害</span>
                <span class="stat-value">${Math.round((char.critDamage || 0.5)*100)}%</span>
            </div>
            ${eidolonHtml}
            <div class="status-section">
                <div class="status-title">✨ 正面状态</div>
                <div class="status-list" id="buff-list">${renderStatusList(char.buffs || [])}</div>
            </div>
            <div class="status-section">
                <div class="status-title">⚠️ 负面状态</div>
                <div class="status-list" id="debuff-list">${renderStatusList(char.debuffs || [])}</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-info').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// 显示敌人详情弹窗（属性也使用图片）
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
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/HP.webp" style="${imgStyle}" alt="生命">生命值</span>
                <span class="stat-value">${enemy.hp} / ${enemy.maxHp}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/ATK.webp" style="${imgStyle}" alt="攻击">攻击力</span>
                <span class="stat-value">${enemy.attack}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/def.webp" style="${imgStyle}" alt="防御">防御力</span>
                <span class="stat-value">${enemy.defense}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label"><img src="/attribute_image/SPD.webp" style="${imgStyle}" alt="速度">速度</span>
                <span class="stat-value">${enemy.speed || '??'}</span>
            </div>
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