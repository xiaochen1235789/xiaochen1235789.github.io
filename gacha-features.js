/**
 * 六哥荣耀WIKI - 抽卡模拟器 + 卡池倒计时
 * 版本: 1.0
 * 说明: 从页面中提取角色/光锥数据，实现抽卡模拟；显示当前卡池倒计时。
 * 使用方法: 
 *   1. 在HTML中添加抽卡模拟器和倒计时的容器（见下文示例）。
 *   2. 在页面底部引入本文件。
 *   3. 根据实际版本修改倒计时结束时间（END_TIMES对象）。
 */

(function() {
    // ==================== 配置项 ====================
    // 卡池结束时间（格式：'YYYY-MM-DD HH:MM:SS'）
    const END_TIMES = {
        character: '2026-03-01 14:59:59', // 角色池结束时间
        lightcone: '2026-03-01 14:59:59'   // 光锥池结束时间
    };

    // 抽卡概率配置（百分比）
    const PROBABILITY = {
        character: { fiveStar: 0.6, fourStar: 5.1 }, // 五星0.6%，四星5.1%，剩余为三星
        lightcone: { fiveStar: 0.8, fourStar: 6.0 }   // 示例光锥池概率
    };

    // 保底抽数
    const PITY_LIMIT = {
        character: 90,
        lightcone: 80
    };

    // ==================== 工具函数 ====================
    function showNotification(message, type = 'info') {
        // 复用页面已有的通知系统，如果没有则创建临时通知
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.className = `notification ${type}`;
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    // 从DOM提取角色数据
    function extractCharacterPool() {
        const cards = document.querySelectorAll('.grid-container[data-category="character"] .content-card');
        return Array.from(cards).map(card => {
            const img = card.querySelector('img');
            return {
                name: card.dataset.name || '未知角色',
                rarity: 5, // 默认为5星，可根据实际情况从卡片内容解析（如data-desc含"五星"）
                type: '角色',
                image: img ? img.src : ''
            };
        }).filter(item => item.name !== '未知角色');
    }

    // 从DOM提取光锥数据
    function extractLightConePool() {
        const cards = document.querySelectorAll('.grid-container[data-category="lightcone"] .content-card');
        return Array.from(cards).map(card => {
            const img = card.querySelector('img');
            return {
                name: card.dataset.name || '未知光锥',
                rarity: 5,
                type: '光锥',
                image: img ? img.src : ''
            };
        }).filter(item => item.name !== '未知光锥');
    }

    // 材料池（可自定义）
    const materialPool = [
        { name: '清风碎片', rarity: 3, type: '材料', image: 'https://xiaochen1235789.github.io/materials/清风碎片.webp' },
        { name: '御风晶片', rarity: 3, type: '材料', image: 'https://xiaochen1235789.github.io/materials/御风晶片.webp' },
        { name: '万风核心', rarity: 4, type: '材料', image: 'https://xiaochen1235789.github.io/materials/万风核心.webp' },
        { name: '纯白祈愿结晶', rarity: 4, type: '材料', image: 'https://xiaochen1235789.github.io/materials/纯白祈愿结晶.webp' }
    ];

    // ==================== 抽卡模拟器核心逻辑 ====================
    const characterPool = extractCharacterPool();
    const lightConePool = extractLightConePool();

    // 保底数据（从localStorage读取）
    let pity = {
        character: { count: 0, guarantee: false },
        lightcone: { count: 0, guarantee: false }
    };

    function loadPity() {
        const saved = localStorage.getItem('gachaPity');
        if (saved) {
            try {
                pity = JSON.parse(saved);
            } catch (e) {}
        }
        updatePityDisplay();
    }

    function savePity() {
        localStorage.setItem('gachaPity', JSON.stringify(pity));
        updatePityDisplay();
    }

    function updatePityDisplay() {
        const charPity = document.getElementById('char-pity');
        const charGuarantee = document.getElementById('char-guarantee');
        const lcPity = document.getElementById('lc-pity');
        const lcGuarantee = document.getElementById('lc-guarantee');
        if (charPity) charPity.textContent = pity.character.count;
        if (charGuarantee) charGuarantee.textContent = pity.character.guarantee ? '是' : '否';
        if (lcPity) lcPity.textContent = pity.lightcone.count;
        if (lcGuarantee) lcGuarantee.textContent = pity.lightcone.guarantee ? '是' : '否';
    }

    // 从指定池子按稀有度随机选取一项
    function getRandomItemFromPool(pool, rarity) {
        const filtered = pool.filter(item => item.rarity === rarity);
        if (filtered.length === 0) return null;
        return filtered[Math.floor(Math.random() * filtered.length)];
    }

    // 单抽
    function pull(poolType) {
        let item = null;
        let rarity = 3; // 默认三星

        if (poolType === 'character') {
            pity.character.count++;
            if (pity.character.count >= PITY_LIMIT.character) {
                rarity = 5;
                pity.character.count = 0;
                // 大保底逻辑简化：直接获得五星
            } else {
                const r = Math.random() * 100;
                if (r < PROBABILITY.character.fiveStar) {
                    rarity = 5;
                } else if (r < PROBABILITY.character.fiveStar + PROBABILITY.character.fourStar) {
                    rarity = 4;
                } else {
                    rarity = 3;
                }
            }

            if (rarity === 5) {
                pity.character.count = 0;
                item = getRandomItemFromPool(characterPool, 5);
                if (!item) item = { name: '五星角色', rarity: 5, type: '角色', image: '' };
            } else if (rarity === 4) {
                item = getRandomItemFromPool(characterPool, 4) || { name: '四星角色', rarity: 4, type: '角色', image: '' };
            } else {
                // 三星材料
                const materials = materialPool.filter(m => m.rarity === 3);
                item = materials.length ? materials[Math.floor(Math.random() * materials.length)] : { name: '经验材料', rarity: 3, type: '材料', image: '' };
            }
        } else if (poolType === 'lightcone') {
            // 类似角色池逻辑（略，可自行完善）
            // 此处简化为随机返回光锥
            pity.lightcone.count++;
            if (pity.lightcone.count >= PITY_LIMIT.lightcone) {
                rarity = 5;
                pity.lightcone.count = 0;
            } else {
                const r = Math.random() * 100;
                if (r < PROBABILITY.lightcone.fiveStar) rarity = 5;
                else if (r < PROBABILITY.lightcone.fiveStar + PROBABILITY.lightcone.fourStar) rarity = 4;
                else rarity = 3;
            }
            if (rarity === 5) {
                pity.lightcone.count = 0;
                item = getRandomItemFromPool(lightConePool, 5) || { name: '五星光锥', rarity: 5, type: '光锥', image: '' };
            } else if (rarity === 4) {
                item = getRandomItemFromPool(lightConePool, 4) || { name: '四星光锥', rarity: 4, type: '光锥', image: '' };
            } else {
                item = { name: '光锥强化材料', rarity: 3, type: '材料', image: '' };
            }
        } else if (poolType === 'mixed') {
            // 混合池：随机决定从角色池还是光锥池抽取
            if (Math.random() < 0.5) {
                return pull('character');
            } else {
                return pull('lightcone');
            }
        }

        savePity();
        return item;
    }

    // 十连抽
    function tenPull(poolType) {
        const results = [];
        for (let i = 0; i < 10; i++) {
            results.push(pull(poolType));
        }
        displayResults(results);
    }

    // 显示抽卡结果
    function displayResults(items) {
        const container = document.getElementById('pull-results');
        if (!container) return;
        container.innerHTML = '';
        items.forEach(item => {
            if (!item) return;
            const card = document.createElement('div');
            card.className = `content-card ${item.type === '光锥' ? 'lightcone-card' : ''}`;
            card.setAttribute('data-type', item.type);
            card.innerHTML = `
                <div class="card-img skeleton">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" onload="this.classList.add('loaded'); this.closest('.skeleton')?.classList.remove('skeleton');" onerror="this.style.display='none'; this.closest('.skeleton')?.classList.remove('skeleton');">
                </div>
                <div class="card-name">${item.name}</div>
                <div class="card-desc">${item.type} · ${item.rarity}星</div>
            `;
            container.appendChild(card);
        });
    }

    // 初始化抽卡模拟器事件
    function initGachaSimulator() {
        const singleBtn = document.getElementById('single-pull');
        const tenBtn = document.getElementById('ten-pull');
        const poolSelect = document.getElementById('pool-select');
        if (!singleBtn || !tenBtn || !poolSelect) return;

        singleBtn.addEventListener('click', () => {
            const pool = poolSelect.value;
            const result = pull(pool);
            displayResults([result]);
        });

        tenBtn.addEventListener('click', () => {
            const pool = poolSelect.value;
            tenPull(pool);
        });

        loadPity();
    }

    // ==================== 卡池倒计时 ====================
    function initGachaTimers() {
        const endTimesStamp = {
            character: new Date(END_TIMES.character).getTime(),
            lightcone: new Date(END_TIMES.lightcone).getTime()
        };

        function updateCountdown() {
            const now = new Date().getTime();

            // 更新角色池
            updateTimer('char', endTimesStamp.character);
            // 更新光锥池
            updateTimer('lc', endTimesStamp.lightcone);
        }

        function updateTimer(prefix, endTime) {
            const daysEl = document.getElementById(`${prefix}-days`);
            const hoursEl = document.getElementById(`${prefix}-hours`);
            const minutesEl = document.getElementById(`${prefix}-minutes`);
            const secondsEl = document.getElementById(`${prefix}-seconds`);
            if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

            const now = new Date().getTime();
            const diff = endTime - now;

            if (diff <= 0) {
                daysEl.textContent = '00';
                hoursEl.textContent = '00';
                minutesEl.textContent = '00';
                secondsEl.textContent = '00';
                // 显示已结束标记
                const container = document.getElementById(`${prefix === 'char' ? 'character' : 'lightcone'}-pool-timer`);
                if (container && !container.querySelector('.pool-ended')) {
                    const ended = document.createElement('div');
                    ended.className = 'pool-ended';
                    ended.style.color = '#f87171';
                    ended.style.marginTop = '10px';
                    ended.style.fontWeight = '600';
                    ended.textContent = '⏳ 卡池已结束';
                    container.appendChild(ended);
                }
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (86400000)) / (3600000));
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            daysEl.textContent = days.toString().padStart(2, '0');
            hoursEl.textContent = hours.toString().padStart(2, '0');
            minutesEl.textContent = minutes.toString().padStart(2, '0');
            secondsEl.textContent = seconds.toString().padStart(2, '0');
        }

        // 卡池切换
        const poolBtns = document.querySelectorAll('.pool-btn');
        const timers = {
            character: document.getElementById('character-pool-timer'),
            lightcone: document.getElementById('lightcone-pool-timer')
        };
        if (poolBtns.length && timers.character && timers.lightcone) {
            poolBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    poolBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    const pool = this.dataset.pool;
                    if (pool === 'character') {
                        timers.character.classList.remove('hidden');
                        timers.lightcone.classList.add('hidden');
                    } else {
                        timers.lightcone.classList.remove('hidden');
                        timers.character.classList.add('hidden');
                    }
                });
            });
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // ==================== 整体初始化 ====================
    function init() {
        // 检查必要的DOM元素是否存在，如果不存在则提示
        if (document.getElementById('gacha-section') || document.querySelector('.gacha-timer-container')) {
            initGachaSimulator();
            initGachaTimers();
        } else {
            console.warn('未检测到抽卡模拟器或倒计时容器，请确保已在HTML中添加对应结构。');
        }
    }

    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();