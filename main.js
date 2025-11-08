// 页面加载完成后初始化所有技能功能
document.addEventListener('DOMContentLoaded', () => {
  // 遍历所有技能控制区域，批量初始化
  document.querySelectorAll('.level-control').forEach(controlEl => {
    // 1. 获取当前技能的关键元素
    const skillName = controlEl.getAttribute('data-skill'); // 技能名称（普攻/战技等）
    const skillItem = controlEl.closest('.skill-item'); // 技能父容器
    const currentLevelEl = controlEl.querySelector('.current-level'); // 当前等级显示
    const levelPanel = skillItem.querySelector('.level-panel'); // 等级面板
    const minusBtn = controlEl.querySelector('[data-dir="-"]'); // 减级按钮
    const plusBtn = controlEl.querySelector('[data-dir="+"]'); // 升级按钮
    const skillData = window.SKILL_DATA[skillName]; // 当前技能的完整数据

    // 2. 初始化当前等级（从HTML默认值获取）
    let currentLevel = parseInt(currentLevelEl.textContent);
    const minLevel = skillData.min;
    const maxLevel = skillData.max;


    // 3. 生成等级面板：显示每级描述+高亮数值
    function renderLevelPanel() {
      levelPanel.innerHTML = ''; // 清空旧内容
      // 遍历当前技能的所有等级数据
      Object.keys(skillData.levels).forEach(levelKey => {
        const level = parseInt(levelKey);
        const levelInfo = skillData.levels[level];
        const levelItem = document.createElement('div');
        
        // 标记当前等级，突出显示
        levelItem.className = `level-item ${level === currentLevel ? 'current' : ''}`;
        
        // 不同技能的数值高亮处理
        let descHtml = '';
        switch (skillName) {
          case '普攻':
            descHtml = `
              <strong>Lv${level}</strong>：对指定敌方单体造成等同于鹿管
              <span class="highlight-num">${levelInfo.damage}%</span>
              攻击力的风属性伤害
            `;
            break;
          case '战技':
            descHtml = `
              <strong>Lv${level}</strong>：对指定敌方单体造成等同于鹿管
              <span class="highlight-num">${levelInfo.damage}%</span>
              攻击力的风属性伤害，此次造成的伤害触发暴击时，有100%固定概率使受到攻击的敌方目标防御降低
              <span class="highlight-num">35%</span>
              ，持续
              <span class="highlight-num">2</span>
              回合
            `;
            break;
          case '终结技':
            descHtml = `
              <strong>Lv${level}</strong>：对指定敌方单体造成等同于鹿管
              <span class="highlight-num">${levelInfo.damage}%</span>
              攻击力的风属性伤害，当受到攻击的敌方目标处于负面效果时，鹿管终结技造成的伤害倍率提高
              <span class="highlight-num">${levelInfo.bonus}%</span>
            `;
            break;
          case '天赋':
            descHtml = `
              <strong>Lv${level}</strong>：当鹿管击杀敌方目标时，每击杀1个敌方目标提升当局风属性抗性穿透提高
              <span class="highlight-num">${levelInfo.penetration}%</span>
              ，最多提高
              <span class="highlight-num">22%</span>
              ，攻击提高
              <span class="highlight-num">5%</span>
              ，最多提高
              <span class="highlight-num">50%</span>
            `;
            break;
        }

        levelItem.innerHTML = descHtml;
        // 点击等级条目直接切换等级
        levelItem.addEventListener('click', () => {
          currentLevel = level;
          updateSkillState();
          renderLevelPanel();
        });
        
        levelPanel.appendChild(levelItem);
      });
    }


    // 4. 更新技能状态：按钮禁用/启用、当前等级显示
    function updateSkillState() {
      currentLevelEl.textContent = currentLevel;
      // 边界控制：等级到最小/最大时禁用对应按钮
      minusBtn.disabled = currentLevel <= minLevel;
      plusBtn.disabled = currentLevel >= maxLevel;
    }


    // 5. 绑定按钮点击事件（升级/减级）
    minusBtn.addEventListener('click', () => {
      if (currentLevel > minLevel) {
        currentLevel--;
        updateSkillState();
        renderLevelPanel();
      }
    });

    plusBtn.addEventListener('click', () => {
      if (currentLevel < maxLevel) {
        currentLevel++;
        updateSkillState();
        renderLevelPanel();
      }
    });


    // 6. 绑定技能名称点击事件：展开/收起等级面板
    skillItem.querySelector('.skill-name').addEventListener('click', () => {
      levelPanel.classList.toggle('open');
    });


    // 7. 初始化：首次加载生成面板+更新状态
    renderLevelPanel();
    updateSkillState();
  });
});