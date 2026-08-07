// ================================================================
//  js/constants.js  -  所有固定配置（支持角色/光锥/复刻池）
// ================================================================

// ---------- Supabase 数据库 ----------
export const SUPABASE_URL = 'https://ysmijycsyzpjoieaknmb.supabase.co';
export const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbWlqeWNzeXpwam9pZWFrbm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNDgzNjMsImV4cCI6MjA4MjgyNDM2M30.H7dx2k_0099LVXprMrghHOFh16OoSSgtCUOib2otHPA';

// ---------- 保底与概率（默认值，会被数据库覆盖） ----------
export const DEFAULT_BASE_RATE_4 = 0.051;
export const DEFAULT_PITY_5_MAX = 90;
export const DEFAULT_PITY_4_MAX = 10;
export const DEFAULT_SOFT_PITY_START = 74;

// ---------- 溢出补偿（默认值，会被数据库覆盖） ----------
export const DEFAULT_OVERFLOW_COMP_5 = 800;
export const DEFAULT_OVERFLOW_COMP_4 = 160;

// ---------- 兑换汇率 ----------
export const EXCHANGE_RATE = 160;

// ---------- 缓存与分页 ----------
export const CACHE_TTL = 3600000;           // 1小时
export const HISTORY_PAGE_SIZE = 5;

// ================================================================
//  ★★★ 通用物品类型定义 ★★★
// ================================================================
export const ITEM_TYPES = {
    CHARACTER: 'character',    // 角色（命座系统）
    LIGHT_CONE: 'light_cone',  // 光锥（精炼系统）
};

// ================================================================
//  ★★★ 每种物品类型的“重复获取规则” ★★★
//  扩展方式：新增一个 key，value 填 maxLevel 和溢出补偿
// ================================================================
export const DUPLICATE_RULES = {
    [ITEM_TYPES.CHARACTER]: {
        maxLevel: 6,                    // 命座最高6层
        overflowComp5: 800,             // 满命后五星重复补偿
        overflowComp4: 160,             // 满命后四星重复补偿
        levelLabel: '命座',             // UI显示文字
        icon: '⭐'                       // 图标
    },
    [ITEM_TYPES.LIGHT_CONE]: {
        maxLevel: 5,                    // 精炼最高5阶
        overflowComp5: 800,             // 满精后五星重复补偿
        overflowComp4: 160,             // 满精后四星重复补偿
        levelLabel: '精炼',
        icon: '🔱'
    }
    // 未来新增类型，直接在这里加即可
};

// ================================================================
//  ★★★ 卡池类型定义 ★★★
// ================================================================
export const BANNER_TYPES = {
    CHARACTER: 'character',   // 角色UP池
    LIGHT_CONE: 'light_cone', // 光锥UP池
    MIXED: 'mixed',           // 混合池（角色+光锥同时UP）
};

// ================================================================
//  ★★★ 内置头像框/立绘占位（如数据库无图时使用） ★★★
// ================================================================
export const FALLBACK_SPLASH = 'https://xiaochen1235789.github.io/images/changjinglu.webp';