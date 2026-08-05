import { SUPABASE_URL, SUPABASE_KEY, CONFIG, CHEST_CONFIG } from './config.js';
import { showNotification, getLocalDateString, clearProfileCache, setCachedProfile } from './utils.js';

let supabaseClient = null;

export function initSupabase() {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;
    return supabaseClient;
}

export function getSupabase() {
    if (!supabaseClient) initSupabase();
    return supabaseClient;
}

// ========== 用户数据 ==========
export async function fetchUserFullData(userId) {
    const sb = getSupabase();
    const [profileRes, statsRes] = await Promise.all([
        sb.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
    ]);
    
    let profile = profileRes.data;
    if (!profile) {
        const { data: { user } } = await sb.auth.getUser();
        profile = {
            id: userId,
            username: user?.email?.split('@')[0] || '用户',
            bio: '',
            avatar_url: null,
            role: 'user',
            created_at: user?.created_at || new Date().toISOString(),
            owned_frames: ['nature'],
            equipped_frame: 'nature',
            equipped_title_id: null
        };
    }
    
    let stats = statsRes.data;
    if (!stats) {
        stats = {
            user_id: userId,
            candy_crumbles: 0,
            rainbow_lollipops: 0,
            dreamy_syrup: 0,
            active_points: 0,
            checkin_streak: 0,
            last_checkin_date: null,
            last_login: null,
            chest_count: 0,
            last_chest_grant_date: null,
            chest_pity_counter: 0
        };
    }
    return { ...profile, ...stats };
}

// 注意：此函数仅供管理员调用（直接 UPDATE），普通用户应通过 RPC
export async function updateUserProfile(userId, updates) {
    const sb = getSupabase();
    const { error } = await sb.from('user_profiles').update(updates).eq('id', userId);
    if (error) throw error;
    clearProfileCache();
}

// 此函数仅供管理员调用，普通用户应通过 RPC
export async function updateUserStats(userId, updates) {
    const sb = getSupabase();
    const { error } = await sb.from('user_stats').update(updates).eq('user_id', userId);
    if (error) throw error;
    clearProfileCache();
}

// ========== 签到 ==========
export async function getCheckinConfig(dayNum) {
    const sb = getSupabase();
    const { data, error } = await sb.from('checkin_config').select('candy, rainbow, active').eq('day_num', dayNum).maybeSingle();
    if (data) return data;
    const { data: fallback } = await sb.from('checkin_config').select('candy, rainbow, active').eq('day_num', 9999).single();
    return fallback || CONFIG.FALLBACK_CHECKIN_REWARD;
}

export async function loadAutoSignCardStatus(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_auto_sign_card').select('owned').eq('user_id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') return false;
    return data?.owned === true;
}

// 购买自动签到卡（改为 RPC）
export async function purchaseAutoSignCard(userId, candyCost) {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('purchase_auto_card', { p_user_id: userId });
    if (error) throw new Error(error.message);
    clearProfileCache();
    return data.new_candy;
}

// ========== 头像框（迁移至数据库） ==========
export async function getShopFrames() {
    const sb = getSupabase();
    const { data, error } = await sb.from('shop_frames')
        .select('*')
        .order('display_order', { ascending: true });
    if (error || !data || data.length === 0) {
        // 回退到 CONFIG.FRAMES
        return CONFIG.FRAMES.map(f => ({
            id: f.id,
            name: f.name,
            description: f.description,
            image_url: f.imageUrl,
            price_candy: f.price_candy || 0,
            price_rainbow: f.price_rainbow || 0,
            is_purchasable: !(f.id === 'frame_fox' || (f.price_candy === 0 && f.price_rainbow === 0 && f.id !== 'nature')),
            is_chest_exclusive: f.id === 'frame_fox' ? true : false,
            scale: f.scale || 1.0
        }));
    }
    return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.image_url,
        price_candy: item.price_candy,
        price_rainbow: item.price_rainbow,
        is_purchasable: item.is_purchasable,
        is_chest_exclusive: item.is_chest_exclusive,
        scale: 1.12
    }));
}

export async function getFrameById(frameId) {
    const frames = await getShopFrames();
    return frames.find(f => f.id === frameId);
}

export async function loadUserFrames(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_profiles')
        .select('owned_frames, equipped_frame')
        .eq('id', userId)
        .maybeSingle();
    if (error || !data) return { owned: ['nature'], equipped: 'nature' };
    let owned = data.owned_frames || ['nature'];
    if (!owned.includes('nature')) owned.push('nature');
    let equipped = data.equipped_frame || 'nature';
    return { owned, equipped };
}

export async function ensureUserFrameFields(userId) {
    const sb = getSupabase();
    const { data: profile } = await sb.from('user_profiles')
        .select('owned_frames, equipped_frame')
        .eq('id', userId)
        .maybeSingle();
    let needUpdate = false;
    let owned = profile?.owned_frames || ['nature'];
    let equipped = profile?.equipped_frame || null;
    if (!owned.includes('nature')) { owned.push('nature'); needUpdate = true; }
    if (!equipped) { equipped = 'nature'; needUpdate = true; }
    if (needUpdate) {
        await sb.from('user_profiles').update({ owned_frames: owned, equipped_frame: equipped }).eq('id', userId);
    }
}

// ========== 称号 ==========
export async function loadAllTitles() {
    const sb = getSupabase();
    const { data, error } = await sb.from('titles').select('*');
    if (error) return [];
    return data;
}

export async function loadUserOwnedTitles(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_titles').select('title_id').eq('user_id', userId);
    if (error) return [];
    return data.map(item => item.title_id);
}

export async function grantTitle(userId, titleId) {
    const sb = getSupabase();
    const { error } = await sb.from('user_titles').insert({ user_id: userId, title_id: titleId });
    if (error) throw error;
}

// =====================================================
// ★★★ 宝箱系统 API（全部改为 RPC 调用） ★★★
// =====================================================

// ---- 从数据库读取价格和保底次数 ----
export async function getChestPrice() {
    const sb = getSupabase();
    const { data, error } = await sb.from('system_config')
        .select('value')
        .eq('key', 'chest_price_candy')
        .maybeSingle();
    if (error || !data) {
        return CHEST_CONFIG.price_candy;
    }
    return parseInt(data.value) || 100;
}

export async function getPityLimit() {
    const sb = getSupabase();
    const { data, error } = await sb.from('system_config')
        .select('value')
        .eq('key', 'chest_pity_limit')
        .maybeSingle();
    if (error || !data) {
        return CHEST_CONFIG.pity_limit;
    }
    return parseInt(data.value) || 100;
}

// ---- 概率配置 ----
export async function getChestProbabilities() {
    const sb = getSupabase();
    const { data, error } = await sb.from('chest_probs').select('*');
    if (error || !data || data.length === 0) {
        return CHEST_CONFIG.default_probs.map(p => ({
            reward_type: p.type,
            reward_extra: p.extra,
            weight: p.weight,
            is_limited: p.is_limited,
            description: p.desc
        }));
    }
    return data;
}

// ---- 宝箱数量（只读） ----
export async function getChestCount(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_stats')
        .select('chest_count, last_chest_grant_date, chest_pity_counter')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data || { chest_count: 0, last_chest_grant_date: null, chest_pity_counter: 0 };
}

// 不再提供 updateChestCount，因为必须通过 RPC 修改

// ---- 每日赠送（改为 RPC） ----
export async function grantDailyChest(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('grant_daily_chest', { p_user_id: userId });
    if (error) throw error;
    return data.granted; // true/false
}

// ---- 商店购买（改为 RPC） ----
export async function purchaseChests(userId, amount, stats) {
    // stats 仅用于前端显示，实际扣费由 RPC 内部计算
    const sb = getSupabase();
    const { data, error } = await sb.rpc('purchase_chests', { p_user_id: userId, p_amount: amount });
    if (error) throw new Error(error.message);
    return { newCandy: data.new_candy, newChest: data.new_chest };
}

// ---- 保底计数器（只读） ----
export async function getPityCounter(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_stats')
        .select('chest_pity_counter')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data?.chest_pity_counter || 0;
}

// ---- 核心开箱（前端计算 + RPC 最终更新） ----
// 注意：此函数保留前端随机计算，但最后调用 RPC 提交更新
// RPC 会校验 chest_count 减少量是否等于 amount，防止用户少报消耗
function calculateChestReward(probs, pityLimit, currentPity) {
    let selected = null;
    let isGuaranteed = false;
    const totalWeight = probs.reduce((s, p) => s + p.weight, 0);

    if (currentPity >= pityLimit - 1) {
        const limited = probs.filter(p => p.is_limited);
        if (limited.length > 0) {
            selected = limited[Math.floor(Math.random() * limited.length)];
            isGuaranteed = true;
            return { selected, isGuaranteed, newPity: 0 };
        }
    }

    let rand = Math.random() * totalWeight;
    for (let p of probs) {
        rand -= p.weight;
        if (rand <= 0) { selected = p; break; }
    }
    if (!selected) selected = probs[0];
    const newPity = selected.is_limited ? 0 : currentPity + 1;
    return { selected, isGuaranteed, newPity };
}

export async function batchOpenChests(userId, amount) {
    const sb = getSupabase();

    // 1. 获取配置
    const [probs, pityLimit] = await Promise.all([
        getChestProbabilities(),
        getPityLimit()
    ]);

    // 2. 获取当前用户数据（仅用于前端显示和计算）
    const { data: stats, error } = await sb.from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!stats || stats.chest_count < amount) throw new Error('宝箱数量不足');

    // 3. 内存计算
    let pityCounter = stats.chest_pity_counter || 0;
    const results = [];
    const updates = {
        candy_crumbles: stats.candy_crumbles || 0,
        rainbow_lollipops: stats.rainbow_lollipops || 0,
        active_points: stats.active_points || 0,
        dreamy_syrup: stats.dreamy_syrup || 0,
        chest_count: stats.chest_count || 0,
        chest_pity_counter: pityCounter
    };
    const frameRequests = [];
    const titleRequests = [];

    for (let i = 0; i < amount; i++) {
        const { selected, isGuaranteed, newPity } = calculateChestReward(probs, pityLimit, pityCounter);
        pityCounter = newPity;
        const type = selected.reward_type;
        const extra = selected.reward_extra;
        let rewardDesc = '';
        let rewardTypeForSummary = type;

        switch (type) {
            case 'candy': {
                const amt = parseInt(extra) || 1000;
                updates.candy_crumbles += amt;
                rewardDesc = `🍬 +${amt.toLocaleString()} 糖果碎`;
                break;
            }
            case 'rainbow': {
                const amt = parseInt(extra) || 10;
                updates.rainbow_lollipops += amt;
                rewardDesc = `🌈 +${amt.toLocaleString()} 超级棒糖`;
                break;
            }
            case 'active': {
                const amt = parseInt(extra) || 100;
                updates.active_points += amt;
                rewardDesc = `⚡ +${amt.toLocaleString()} 活跃度`;
                break;
            }
            case 'frame': {
                const frameId = extra;
                frameRequests.push(frameId);
                const frame = CONFIG.FRAMES.find(f => f.id === frameId);
                rewardDesc = `🖼️ 获得头像框「${frame?.name || frameId}」`;
                rewardTypeForSummary = `头像框「${frame?.name || frameId}」`;
                break;
            }
            case 'title': {
                const titleId = parseInt(extra);
                titleRequests.push(titleId);
                rewardDesc = `🏅 获得称号「${titleId}」`;
                rewardTypeForSummary = `称号「${titleId}」`;
                break;
            }
            default:
                rewardDesc = '🎁 空';
        }
        results.push({ type: rewardDesc || rewardTypeForSummary, isGuaranteed });
    }

    // 4. 处理框架和称号（直接在客户端完成，因为 RPC 只处理 stats 更新）
    if (frameRequests.length > 0) {
        const { data: profile } = await sb.from('user_profiles')
            .select('owned_frames')
            .eq('id', userId)
            .maybeSingle();
        let ownedFrames = profile?.owned_frames || ['nature'];
        let foxConvertCount = 0;
        for (let fId of frameRequests) {
            if (ownedFrames.includes(fId)) {
                if (fId === 'frame_fox') {
                    updates.dreamy_syrup += 100;
                    foxConvertCount++;
                } else {
                    updates.candy_crumbles += 500;
                }
            } else {
                ownedFrames.push(fId);
            }
        }
        if (ownedFrames.length !== (profile?.owned_frames?.length || 0)) {
            await sb.from('user_profiles').update({ owned_frames: ownedFrames }).eq('id', userId);
        }
        if (foxConvertCount > 0) {
            results.push({ type: `🦊 小狐狸×${foxConvertCount} → 🌌 +${foxConvertCount * 100} 星河糖浆`, isGuaranteed: false });
        }
    }

    if (titleRequests.length > 0) {
        const { data: ownedTitles } = await sb.from('user_titles')
            .select('title_id')
            .eq('user_id', userId);
        const ownedTitleIds = (ownedTitles || []).map(t => t.title_id);
        const titlesToInsert = titleRequests.filter(tid => !ownedTitleIds.includes(tid));
        if (titlesToInsert.length > 0) {
            const insertData = titlesToInsert.map(tid => ({ user_id: userId, title_id: tid }));
            await sb.from('user_titles').insert(insertData);
        }
        const duplicateCount = titleRequests.length - titlesToInsert.length;
        if (duplicateCount > 0) {
            updates.rainbow_lollipops += duplicateCount;
        }
    }

    // 5. 更新保底和宝箱数
    updates.chest_pity_counter = pityCounter;
    updates.chest_count = (stats.chest_count || 0) - amount;

    // 6. ★★★ 调用 RPC 提交最终更新 ★★★
    const { data: rpcResult, error: rpcError } = await sb.rpc('finalize_chest_open', {
        p_user_id: userId,
        p_amount: amount,
        p_updates: updates
    });
    if (rpcError) throw new Error(rpcError.message);

    // 7. 获取最终数据
    const { data: finalStats } = await sb.from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    return { results, newStats: finalStats };
}