// relic-data.js - 遗器静态数据（整合多个套装）

// ===================== 套装定义 =====================
const RelicSets = {
    // 四件套
    "新生的未来": {
        id: "future_of_newborn",
        name: "新生的未来",
        twoPc: { critRate: 0.08 },
        fourPc: {
            desc: "装备者攻击力≥1800后，每增加200攻击，使装备者暴击伤害提高15%，最多提高60%",
            effectId: "future_of_newborn_4pc",
            condition: { minAtk: 1800, step: 200, bonusPerStep: 0.15, maxBonus: 0.6 }
        }
    },
    // 二件套
    "过往的旧事物": {
        id: "past_old_things",
        name: "过往的旧事物",
        twoPc: {
            desc: "若装备者速度≥115/140/160，则造成的伤害提高10%/15%/25%",
            effectId: "past_old_things_2pc",
            condition: { thresholds: [115, 140, 160], bonuses: [0.10, 0.15, 0.25] }
        }
        // 注意：二件套没有四件套效果，twoPc 直接是一个条件增伤对象
    }
};

// ===================== 部位定义（主属性可出类型） =====================
const RelicParts = [
    // 新生的未来 四件套部位
    { part: "head",  name: "智慧头套", mainPool: ["hpPercent"] },
    { part: "hands", name: "指挥手套", mainPool: ["atkPercent"] },
    { part: "body",  name: "安心的护甲", mainPool: ["hpPercent", "atkPercent", "defPercent", "critRate", "critDamage", "effectHitRate", "effectRes"] },
    { part: "feet",  name: "健步如飞的靴子", mainPool: ["speed", "hpPercent", "atkPercent", "defPercent", "effectHitRate", "effectRes"] },
    // 过往的旧事物 二件套部位
    { part: "sphere", name: "过去的球", mainPool: ["hpPercent", "atkPercent", "defPercent", "windDamage", "fireDamage", "iceDamage", "imaginaryDamage", "physicalDamage", "quantumDamage"] },
    { part: "rope",   name: "过去的绳", mainPool: ["hpPercent", "atkPercent", "defPercent", "energyRegen", "effectHitRate", "effectRes"] }
];

// ===================== 副词条池（所有部位通用） =====================
const SubStatPool = [
    "hp", "hpPercent", "atk", "atkPercent", "def", "defPercent",
    "speed", "critRate", "critDamage", "effectHitRate", "effectRes"
];

// ===================== 主属性基础值与成长（线性固定值） =====================
const MainStatBase = {
    hpPercent: 4.32,
    atkPercent: 4.32,
    defPercent: 5.76,
    critRate: 3.24,
    critDamage: 6.48,
    speed: 2.3,
    effectHitRate: 4.32,
    effectRes: 4.32,
    // 元素伤害加成（基础4.32%，每级+2.592%？不，按照线性固定值：基础 4.32%，+15级 43.2%，每级增量 (43.2-4.32)/15 = 2.592）
    windDamage: 4.32,
    fireDamage: 4.32,
    iceDamage: 4.32,
    imaginaryDamage: 4.32,
    physicalDamage: 4.32,
    quantumDamage: 4.32,
    energyRegen: 3.24
};

// 每级固定增量（从0级到+15级的总增量 / 15）
const MainStatStep = {
    hpPercent: (43.2 - 4.32) / 15,          // 2.592
    atkPercent: (43.2 - 4.32) / 15,          // 2.592
    defPercent: (57.6 - 5.76) / 15,          // 3.456
    critRate: (32.4 - 3.24) / 15,            // 1.944
    critDamage: (64.8 - 6.48) / 15,          // 3.888
    speed: (25.7 - 2.3) / 15,               // 约1.56（实际取值1.56）
    effectHitRate: (43.2 - 4.32) / 15,       // 2.592
    effectRes: (43.2 - 4.32) / 15,           // 2.592
    windDamage: (43.2 - 4.32) / 15,          // 2.592
    fireDamage: (43.2 - 4.32) / 15,          // 2.592
    iceDamage: (43.2 - 4.32) / 15,           // 2.592
    imaginaryDamage: (43.2 - 4.32) / 15,     // 2.592
    physicalDamage: (43.2 - 4.32) / 15,      // 2.592
    quantumDamage: (43.2 - 4.32) / 15,       // 2.592
    energyRegen: (32.4 - 3.24) / 15          // 1.944
};

// 副词条初始值（0级时每条的值）
const SubStatBase = {
    hp: 38,
    hpPercent: 3.4,
    atk: 19,
    atkPercent: 3.4,
    def: 19,
    defPercent: 4.2,
    speed: 2,
    critRate: 2.6,
    critDamage: 5.2,
    effectHitRate: 3.4,
    effectRes: 3.4
};

// 副词条每次强化的随机浮动范围（乘以基础值）
const SubStatRollRange = { min: 0.8, max: 1.2 };

// ===================== 辅助函数 =====================
// 根据等级计算主属性当前值（线性）
function getRelicMainStatValue(statType, level) {
    if (level === undefined) level = 0;
    const base = MainStatBase[statType];
    const step = MainStatStep[statType];
    if (step === undefined) return base;
    return parseFloat((base + step * level).toFixed(1));
}

// 随机生成一件遗器
function generateRandomRelic(partName, level = 0) {
    const partInfo = RelicParts.find(p => p.part === partName);
    if (!partInfo) throw new Error(`未知部位: ${partName}`);

    // 1. 随机主属性类型
    const mainType = partInfo.mainPool[Math.floor(Math.random() * partInfo.mainPool.length)];
    const mainValue = getRelicMainStatValue(mainType, level);

    // 2. 副词条候选池（排除主属性）
    let candidates = SubStatPool.filter(s => s !== mainType);
    // 随机打乱
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const subCount = Math.random() < 0.5 ? 3 : 4;
    const subStats = candidates.slice(0, subCount).map(type => {
        let base = SubStatBase[type];
        let roll = SubStatRollRange.min + Math.random() * (SubStatRollRange.max - SubStatRollRange.min);
        let value = base * roll;
        if (type === 'speed') {
            value = Math.round(value);
        } else if (type === 'hp' || type === 'atk' || type === 'def') {
            value = Math.floor(value);
        } else {
            value = parseFloat(value.toFixed(1));
        }
        return { type, value };
    });

    return {
        id: `relic_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        setType: partName === 'sphere' || partName === 'rope' ? "过往的旧事物" : "新生的未来",
        part: partName,
        level: level,
        mainStat: { type: mainType, value: mainValue },
        subStats: subStats
    };
}

// ===================== 导出到全局 =====================
window.RelicSets = RelicSets;
window.RelicParts = RelicParts;
window.SubStatPool = SubStatPool;
window.MainStatBase = MainStatBase;
window.MainStatStep = MainStatStep;
window.SubStatBase = SubStatBase;
window.SubStatRollRange = SubStatRollRange;
window.generateRandomRelic = generateRandomRelic;
window.getRelicMainStatValue = getRelicMainStatValue;

console.log('遗器数据加载完成（新生的未来 + 过往的旧事物）');