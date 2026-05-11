// character-rules.js
// 鹿馆角色遗器词条规则配置（档次分级 + 加权评分）

const CharacterRules = {
    // 鹿馆专属规则
    "鹿馆": {
        // 第一档（权重1.0）：核心输出词条
        tier1: ["atkPercent", "critRate", "critDamage", "speed"],
        // 第二档（权重0.5）：有用但次选词条
        tier2: ["atk"],
        // 单条基础分
        scorePerTier1: 1.0,
        scorePerTier2: 0.5,
        // 每次强化的额外分（+3/+6/+9/+12/+15 触发）
        enhanceScore: 1.0,
        // 毕业分数线（加权总分）
        graduationScore: { perfect: 10, good: 6, pass: 4 }
    },

    // 默认规则（通用输出，没有专属配置时使用）
    "default": {
        tier1: ["critRate", "critDamage", "atkPercent", "speed"],
        tier2: ["atk"],
        scorePerTier1: 1.0,
        scorePerTier2: 0.5,
        enhanceScore: 1.0,
        graduationScore: { perfect: 8, good: 6, pass: 4 }
    }
};

/**
 * 根据角色名称获取规则配置
 * @param {string} characterName 角色名称
 * @returns {object} 规则对象
 */
function getCharacterRules(characterName) {
    return CharacterRules[characterName] || CharacterRules["default"];
}

// 导出到全局
window.CharacterRules = CharacterRules;
window.getCharacterRules = getCharacterRules;