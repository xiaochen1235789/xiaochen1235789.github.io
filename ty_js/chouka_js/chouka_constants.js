// ============================================================
//  js/constants.js  -  所有固定数值配置
// ============================================================

// ---------- Supabase 数据库配置 ----------
export const SUPABASE_URL = 'https://ysmijycsyzpjoieaknmb.supabase.co';
export const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbWlqeWNzeXpwam9pZWFrbm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNDgzNjMsImV4cCI6MjA4MjgyNDM2M30.H7dx2k_0099LVXprMrghHOFh16OoSSgtCUOib2otHPA';

// ---------- 保底与概率固定参数 ----------
export const BASE_RATE_4 = 0.051;          // 基础四星概率
export const PITY_5_MAX = 90;             // 五星硬保底
export const PITY_4_MAX = 10;             // 四星保底
export const SOFT_PITY_START = 74;        // 软保底起始抽数（74抽后概率递增）

// ---------- 满命溢出补偿 ----------
export const OVERFLOW_COMP_5 = 800;        // 满命五星重复补偿星琼
export const OVERFLOW_COMP_4 = 160;        // 满命四星重复补偿星琼

// ---------- 商店兑换 ----------
export const EXCHANGE_RATE = 160;          // 160星琼 = 1张星轨专票

// ---------- 缓存过期时间 ----------
export const CACHE_TTL = 3600000;          // 1小时（毫秒）

// ---------- 历史记录分页大小 ----------
export const HISTORY_PAGE_SIZE = 5;