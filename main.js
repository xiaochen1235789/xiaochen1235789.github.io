class SkillLeveler {
  constructor(skillName) {
    this.name = skillName;
    this.data = window.SKILL_DATA[skillName];
    this.current = this.data.default;
    this.controlEl = document.querySelector(`[data-skill="${skillName}"]`);
    this.levelEl = this.controlEl.querySelector('.current-level');
    this.panelEl = this.controlEl.nextElementSibling;
    this.btnMinus = this.controlEl.querySelector('[data-dir="-"]');
    this.btnPlus = this.controlEl.querySelector('[data-dir="+"]');

    this.renderPanel();
    this.sync();
    this.bindEvents();
  }

  renderPanel() {
    const html = Object.entries(this.data.levels).map(([lv, obj]) => {
      const text = `Lv${lv}：${JSON.stringify(obj).replace(/[{}"]/g, '').replace(/,/g, ' | ')}`;
      return `<div class="level-item" data-lv="${lv}">${text}</div>`;
    }).join('');
    this.panelEl.innerHTML = html;
  }

  bindEvents() {
    // ±按钮
    this.controlEl.addEventListener('click', e => {
      const dir = e.target.dataset.dir;
      if (!dir) return;
      dir === '+' ? this.inc() : this.dec();
    });
    // 点击等级数字展开/收起
    this.levelEl.addEventListener('click', () => this.panelEl.classList.toggle('open'));
    // 点击面板项快速切换
    this.panelEl.addEventListener('click', e => {
      const lv = +e.target.dataset.lv;
      if (!isNaN(lv)) {
        this.current = lv;
        this.sync();
        this.panelEl.classList.remove('open');
      }
    });
  }

  inc() { if (this.current < this.data.max) { this.current++; this.sync(); } }
  dec() { if (this.current > this.data.min) { this.current--; this.sync(); } }

  sync() {
    this.levelEl.textContent = this.current;
    // 禁用按钮 & 提示
    this.btnMinus.disabled = this.current === this.data.min;
    this.btnPlus.disabled = this.current === this.data.max;
    // 高亮当前等级
    this.panelEl.querySelectorAll('.level-item').forEach(el => {
      el.classList.toggle('current', +el.dataset.lv === this.current);
    });
  }
}

// 初始化
['普攻', '战技', '终结技', '天赋'].forEach(name => new SkillLeveler(name));