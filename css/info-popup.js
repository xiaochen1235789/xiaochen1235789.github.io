// 显示角色详情弹窗
function showCharacterInfo(characterIndex) {
    const char = window.getCharacterDataForPopup ? window.getCharacterDataForPopup() : null;
    if (!char) return;

    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <h3>${char.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            <div class="stat-row"><span class="stat-label">❤️ 生命值</span><span class="stat-value">${char.hp} / ${char.maxHp}</span></div>
            <div class="stat-row"><span class="stat-label">⚔️ 攻击力</span><span class="stat-value">${char.attack}</span></div>
            <div class="stat-row"><span class="stat-label">🛡️ 防御力</span><span class="stat-value">${char.defense}</span></div>
            <div class="stat-row"><span class="stat-label">⚡ 速度</span><span class="stat-value">${char.speed}</span></div>
            <div class="stat-row"><span class="stat-label">💥 暴击率</span><span class="stat-value">${Math.round((char.critRate || 0.05)*100)}%</span></div>
            <div class="stat-row"><span class="stat-label">💢 暴击伤害</span><span class="stat-value">${Math.round((char.critDamage || 0.5)*100)}%</span></div>
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

// 显示敌人详情弹窗（只显示血量、攻击等基础属性 + 状态，无抗性等额外信息）
function showEnemyInfo(enemyIndex) {
    const enemy = window.getEnemyDataForPopup ? window.getEnemyDataForPopup(enemyIndex) : null;
    if (!enemy) return;

    const modal = document.createElement('div');
    modal.className = 'info-modal';
    modal.innerHTML = `
        <div class="info-card">
            <div class="info-header">
                <h3>${enemy.name}</h3>
                <button class="close-info">&times;</button>
            </div>
            <div class="stat-row"><span class="stat-label">❤️ 生命值</span><span class="stat-value">${enemy.hp} / ${enemy.maxHp}</span></div>
            <div class="stat-row"><span class="stat-label">⚔️ 攻击力</span><span class="stat-value">${enemy.attack}</span></div>
            <div class="stat-row"><span class="stat-label">🛡️ 防御力</span><span class="stat-value">${enemy.defense}</span></div>
            <div class="stat-row"><span class="stat-label">⚡ 速度</span><span class="stat-value">${enemy.speed || '??'}</span></div>
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

function renderStatusList(list) {
    if (!list || list.length === 0) return '<div style="color:#aaa;">无</div>';
    return list.map(s => `<div class="status-item">${s.name || s}</div>`).join('');
}