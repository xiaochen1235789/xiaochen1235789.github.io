// ================================================================
//  js/state.js  -  通用游戏状态管理
//  支持：共享保底、多池子切换（复刻池）、角色命座/精炼（未来扩展）
// ================================================================

import {
    DEFAULT_BASE_RATE_4,
    DEFAULT_PITY_5_MAX,
    DEFAULT_PITY_4_MAX,
    DEFAULT_SOFT_PITY_START,
    DEFAULT_OVERFLOW_COMP_5,
    DEFAULT_OVERFLOW_COMP_4,
    EXCHANGE_RATE,
    DUPLICATE_RULES,
    ITEM_TYPES
} from './constants.js';

// ================================================================
//  核心状态对象
// ================================================================
export const state = {
    // ---------- 用户 ----------
    user: null,
    userNumber: null,

    // ---------- 卡池信息（当前选中的池子） ----------
    currentBanner: null,          // 当前选中的池子对象
    bannerStart: null,            // 当前池子开始时间
    bannerEnd: null,              // 当前池子结束时间
    bannerType: null,             // 'character' | 'light_cone' | 'mixed'
    upFiveStarList: [],           // 当前池子的UP列表（数组，支持多UP）

    // ---------- ★★★ 所有开放中的池子列表 ★★★ ----------
    bannerList: [],               // 从数据库加载的所有开放池子
    selectedBannerIndex: -1,      // 当前选中的池子在 bannerList 中的索引

    // ---------- 四星/三星池（全局共享） ----------
    permanentFiveStar: [],
    fourStarChars: [],
    threeStarItems: [],

    // ---------- 概率参数（会被数据库覆盖） ----------
    baseRate4: DEFAULT_BASE_RATE_4,
    pity5Max: DEFAULT_PITY_5_MAX,
    pity4Max: DEFAULT_PITY_4_MAX,
    softPityStart: DEFAULT_SOFT_PITY_START,
    overflowComp5: DEFAULT_OVERFLOW_COMP_5,
    overflowComp4: DEFAULT_OVERFLOW_COMP_4,
    exchangeRate: EXCHANGE_RATE,

    // ---------- ★ 共享保底（所有池子共用） ----------
    fiveStarPity: 0,               // 五星保底计数器 (0~90)
    fourStarPity: 0,               // 四星保底计数器 (0~10)
    guaranteedUp: false,           // true = 大保底（必出UP）

    // ---------- 玩家资源 ----------
    starJade: 0,
    tickets: 0,

    // ---------- 抽卡历史 ----------
    gachaHistory: [],              // [{ name, star, type? }, ...]

    // ============================================================
    //  ★★★ 通用物品仓库（核心） ★★★
    //  存储所有已获得的角色、光锥等，支持星级固化
    //  格式：Map<`${itemType}_${itemName}`, { level, star, type }>
    // ============================================================
    inventory: new Map(),

    // ---------- 统计数据 ----------
    totalPulls: 0,
    fiveStarCount: 0,
    fourStarCount: 0,
    threeStarCount: 0,
    upFiveStarCount: 0,
    fiveStarDistances: [],
    lastFiveStarPullIndex: 0,

    // ---------- UI控制 ----------
    isDrawing: false,
};

// ================================================================
//  辅助函数：获取物品的重复规则
// ================================================================
export function getItemRule(itemType) {
    return DUPLICATE_RULES[itemType] || null;
}

// ================================================================
//  辅助函数：从数据库配置覆盖 state 参数
// ================================================================
export function applyDatabaseConfig(dbConfig) {
    if (!dbConfig) return;
    if (dbConfig.base_rate_4 !== undefined) state.baseRate4 = dbConfig.base_rate_4;
    if (dbConfig.pity_5_max !== undefined) state.pity5Max = dbConfig.pity_5_max;
    if (dbConfig.pity_4_max !== undefined) state.pity4Max = dbConfig.pity_4_max;
    if (dbConfig.soft_pity_start !== undefined) state.softPityStart = dbConfig.soft_pity_start;
    if (dbConfig.compensation_5_overflow !== undefined) state.overflowComp5 = dbConfig.compensation_5_overflow;
    if (dbConfig.compensation_4_overflow !== undefined) state.overflowComp4 = dbConfig.compensation_4_overflow;
    if (dbConfig.exchange_rate !== undefined) state.exchangeRate = dbConfig.exchange_rate;
}

// ================================================================
//  ★★★ 核心函数：添加/更新物品到仓库（统一处理命座/精炼） ★★★
// ================================================================
export function addItemToInventory(itemType, itemName, starLevel) {
    const rule = getItemRule(itemType);
    if (!rule) {
        // 没有规则的物品，直接存一次，不升级
        const key = `${itemType}_${itemName}`;
        if (!state.inventory.has(key)) {
            state.inventory.set(key, { level: 0, star: starLevel, type: itemType });
        }
        return { action: 'first', newLevel: 0 };
    }

    const key = `${itemType}_${itemName}`;
    const entry = state.inventory.get(key);
    const currentLevel = entry ? entry.level : 0;
    const maxLevel = rule.maxLevel;

    // 情况1：首次获得
    if (!entry) {
        state.inventory.set(key, { level: 0, star: starLevel, type: itemType });
        return { action: 'first', newLevel: 0 };
    }

    // 情况2：未满级 → 升级
    if (currentLevel < maxLevel) {
        const newLevel = currentLevel + 1;
        state.inventory.set(key, { level: newLevel, star: starLevel, type: itemType });
        return { action: 'upgrade', newLevel };
    }

    // 情况3：已满级 → 溢出补偿
    const compensation = starLevel === 5 ? rule.overflowComp5 : rule.overflowComp4;
    state.starJade += compensation;
    return { action: 'overflow', compensation };
}

// ================================================================
//  辅助函数：重置所有抽卡数据（保留用户信息和卡池）
// ================================================================
export function resetGachaData() {
    state.fiveStarPity = 0;
    state.fourStarPity = 0;
    state.guaranteedUp = false;
    state.gachaHistory = [];
    state.inventory.clear();
    state.totalPulls = 0;
    state.fiveStarCount = 0;
    state.fourStarCount = 0;
    state.threeStarCount = 0;
    state.upFiveStarCount = 0;
    state.fiveStarDistances = [];
    state.lastFiveStarPullIndex = 0;
    state.isDrawing = false;
    // 注意：不重置 bannerList 和 currentBanner，因为它们属于卡池信息，不应被重置
}

// ================================================================
//  辅助函数：从 Map 中获取物品的星级（用于 UI 渲染）
// ================================================================
export function getItemStar(itemType, itemName) {
    const key = `${itemType}_${itemName}`;
    const entry = state.inventory.get(key);
    return entry ? entry.star : null;
}

// ================================================================
//  辅助函数：获取某个类型的所有物品（用于统计面板）
// ================================================================
export function getItemsByType(itemType) {
    const result = [];
    for (const [key, value] of state.inventory) {
        if (value.type === itemType) {
            // 从 key 中提取名称（去掉 "type_" 前缀）
            const name = key.substring(itemType.length + 1);
            result.push({ name, ...value });
        }
    }
    return result;
}

// ================================================================
//  辅助函数：切换池子时更新当前卡池信息（供 ui.js 调用）
// ================================================================
export function selectBanner(index) {
    const banners = state.bannerList || [];
    if (index < 0 || index >= banners.length) return false;
    if (index === state.selectedBannerIndex) return true;

    const banner = banners[index];
    state.selectedBannerIndex = index;
    state.currentBanner = banner;
    state.bannerStart = new Date(banner.start_time);
    state.bannerEnd = new Date(banner.end_time);
    state.bannerType = banner.banner_type || 'character';

    // 解析 UP 列表（支持 up_five_star_list 或 up_five_star）
    if (banner.up_five_star_list && Array.isArray(banner.up_five_star_list) && banner.up_five_star_list.length > 0) {
        state.upFiveStarList = banner.up_five_star_list;
    } else if (banner.up_five_star) {
        if (banner.up_five_star.includes(',')) {
            state.upFiveStarList = banner.up_five_star.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            state.upFiveStarList = [banner.up_five_star];
        }
    } else {
        state.upFiveStarList = [];
    }

    return true;
}