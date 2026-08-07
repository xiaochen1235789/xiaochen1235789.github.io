// ================================================================
//  js/db.js  -  所有 Supabase 数据库操作
//  支持：用户数据、通用库存（角色/光锥）、卡池、历史记录
// ================================================================

import { SUPABASE_URL, SUPABASE_KEY, CACHE_TTL } from './constants.js';
import { state, applyDatabaseConfig, addItemToInventory } from './state.js';

// ---------- 初始化 Supabase 客户端 ----------
let supabaseClient = null;

export function getSupabase() {
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseClient = supabaseClient;
    }
    return supabaseClient;
}

// ---------- 缓存工具 ----------
function getCached(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch {
        return null;
    }
}

function setCached(key, data) {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

// ================================================================
//  1. 用户数据加载
// ================================================================
export async function loadUserData(userId) {
    const sb = getSupabase();

    // 并行加载所有数据
    const [
        profileRes,
        statsRes,
        historyRes,
        inventoryRes,
        configRes,
        bannerRes
    ] = await Promise.all([
        sb.from('user_profiles').select('user_number').eq('id', userId).maybeSingle(),
        sb.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
        sb.from('gacha_history').select('item_name, star_level, item_type').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(2000),
        sb.from('user_inventory').select('item_type, item_name, level, star_level').eq('user_id', userId),
        sb.from('gacha_config').select('*').single(),
        sb.from('gacha_banners').select('*')
            .lte('start_time', new Date().toISOString())
            .gte('end_time', new Date().toISOString())
            .maybeSingle()
    ]);

    // ---- 处理用户信息 ----
    if (profileRes.data) {
        state.userNumber = profileRes.data.user_number;
    }

    // ---- 处理资源与保底 ----
    if (statsRes.data) {
        const s = statsRes.data;
        state.starJade = s.star_jade || 0;
        state.tickets = s.tickets || 0;
        state.fiveStarPity = s.five_star_pity || 0;
        state.fourStarPity = s.four_star_pity || 0;
        state.guaranteedUp = s.guaranteed_up || false;
    } else {
        // 如果用户没有 stats 记录，创建默认
        await sb.from('user_stats').insert({
            user_id: userId,
            star_jade: 1599840,
            tickets: 100,
            five_star_pity: 0,
            four_star_pity: 0,
            guaranteed_up: false
        });
        state.starJade = 1599840;
        state.tickets = 100;
        state.fiveStarPity = 0;
        state.fourStarPity = 0;
        state.guaranteedUp = false;
    }

    // ---- 处理卡池信息 ----
    if (bannerRes.data) {
        const b = bannerRes.data;
        state.currentBanner = b;
        state.bannerStart = new Date(b.start_time);
        state.bannerEnd = new Date(b.end_time);
        state.bannerType = b.banner_type || 'character';
        // ★ 支持多个UP（复刻池）
        state.upFiveStarList = b.up_five_star_list || [b.up_five_star].filter(Boolean);
        state.permanentFiveStar = b.permanent_five_star_list || [];
        state.fourStarChars = b.four_star_list || [];
        state.threeStarItems = b.three_star_list || [];
    }

    // ---- 处理概率配置 ----
    if (configRes.data) {
        applyDatabaseConfig(configRes.data);
    }

    // ---- ★★★ 处理通用库存（角色/光锥/未来物品） ★★★ ----
    if (inventoryRes.data) {
        state.inventory.clear();
        for (const row of inventoryRes.data) {
            const key = `${row.item_type}_${row.item_name}`;
            state.inventory.set(key, {
                level: row.level || 0,
                star: row.star_level,
                type: row.item_type
            });
        }
    }

    // ---- 处理历史记录 ----
    if (historyRes.data) {
        state.gachaHistory = historyRes.data.map(h => ({
            name: h.item_name,
            star: h.star_level,
            type: h.item_type || 'character'
        }));
    }

    // ---- 重新计算统计数据 ----
    recalculateStats();

    // ---- 缓存用户数据 ----
    setCached('userData_' + userId, {
        userNumber: state.userNumber,
        starJade: state.starJade,
        tickets: state.tickets,
        fiveStarPity: state.fiveStarPity,
        fourStarPity: state.fourStarPity,
        guaranteedUp: state.guaranteedUp,
        inventory: Array.from(state.inventory.entries()),
        gachaHistory: state.gachaHistory,
        totalPulls: state.totalPulls,
        fiveStarCount: state.fiveStarCount,
        upFiveStarCount: state.upFiveStarCount
    });
}

// ================================================================
//  2. 重新计算统计数据
// ================================================================
function recalculateStats() {
    state.totalPulls = 0;
    state.fiveStarCount = 0;
    state.fourStarCount = 0;
    state.threeStarCount = 0;
    state.upFiveStarCount = 0;
    state.fiveStarDistances = [];
    state.lastFiveStarPullIndex = 0;

    // 从历史记录从旧到新遍历
    const reversed = [...state.gachaHistory].reverse();
    const upList = state.upFiveStarList || [];

    for (const record of reversed) {
        state.totalPulls++;
        if (record.star === 5) {
            state.fiveStarCount++;
            if (state.lastFiveStarPullIndex !== 0) {
                const dist = state.totalPulls - state.lastFiveStarPullIndex;
                state.fiveStarDistances.push(Math.min(dist, state.pity5Max));
            }
            state.lastFiveStarPullIndex = state.totalPulls;
            if (upList.includes(record.name)) {
                state.upFiveStarCount++;
            }
        } else if (record.star === 4) {
            state.fourStarCount++;
        } else {
            state.threeStarCount++;
        }
    }
}

// ================================================================
//  3. ★★★ 保存通用库存到数据库（支持多类型） ★★★
// ================================================================
export async function saveInventory(userId) {
    const sb = getSupabase();
    const items = [];

    for (const [key, value] of state.inventory) {
        // 从 "type_name" 中拆分
        const underscoreIndex = key.indexOf('_');
        if (underscoreIndex === -1) continue;
        const itemType = key.substring(0, underscoreIndex);
        const itemName = key.substring(underscoreIndex + 1);

        items.push({
            user_id: userId,
            item_type: itemType,
            item_name: itemName,
            level: value.level,
            star_level: value.star,
            updated_at: new Date().toISOString()
        });
    }

    if (items.length === 0) return;

    // 使用 upsert 批量更新
    const { error } = await sb.from('user_inventory')
        .upsert(items, { onConflict: 'user_id, item_type, item_name' });

    if (error) throw new Error('保存库存失败: ' + error.message);
}

// ================================================================
//  4. 保存单次抽卡结果（含 item_type）
// ================================================================
export async function saveGachaResult(userId, itemName, starLevel, itemType) {
    const sb = getSupabase();
    const { error } = await sb.from('gacha_history').insert({
        user_id: userId,
        item_name: itemName,
        star_level: starLevel,
        item_type: itemType || 'character',
        created_at: new Date().toISOString()
    });
    if (error) throw error;
}

// ================================================================
//  5. 批量保存抽卡结果
// ================================================================
export async function saveBatchGachaResults(userId, results) {
    const sb = getSupabase();
    const inserts = results.map(r => ({
        user_id: userId,
        item_name: r.name,
        star_level: r.star,
        item_type: r.type || 'character',
        created_at: new Date().toISOString()
    }));
    const { error } = await sb.from('gacha_history').insert(inserts);
    if (error) throw error;
}

// ================================================================
//  6. 保存资源与保底状态
// ================================================================
export async function saveResourcesAndPity(userId) {
    const sb = getSupabase();
    const { error } = await sb.from('user_stats').upsert({
        user_id: userId,
        star_jade: state.starJade,
        tickets: state.tickets,
        five_star_pity: state.fiveStarPity,
        four_star_pity: state.fourStarPity,
        guaranteed_up: state.guaranteedUp,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
}

// ================================================================
//  7. 一次性保存所有数据（抽卡后调用）
// ================================================================
export async function saveAllAfterDraw(userId, results) {
    await Promise.all([
        saveResourcesAndPity(userId),
        saveInventory(userId),
        results && results.length > 0 ? saveBatchGachaResults(userId, results) : Promise.resolve()
    ]);
}

// ================================================================
//  8. 重置所有抽卡数据（清空历史、库存、保底）
// ================================================================
export async function resetAllGachaData(userId) {
    const sb = getSupabase();
    await Promise.all([
        sb.from('gacha_history').delete().eq('user_id', userId),
        sb.from('user_inventory').delete().eq('user_id', userId),
        sb.from('user_stats').update({
            five_star_pity: 0,
            four_star_pity: 0,
            guaranteed_up: false
        }).eq('user_id', userId)
    ]);
}

// ================================================================
//  9. 获取卡池的立绘/背景图
// ================================================================
export function getBannerSplashUrl(banner) {
    return banner?.splash_url || 'https://xiaochen1235789.github.io/images/changjinglu.webp';
}