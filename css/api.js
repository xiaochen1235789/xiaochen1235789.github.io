import { SUPABASE_URL, SUPABASE_KEY, CONFIG } from './config.js';
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
            last_login: null
        };
    }
    return { ...profile, ...stats };
}

export async function updateUserProfile(userId, updates) {
    const sb = getSupabase();
    const { error } = await sb.from('user_profiles').update(updates).eq('id', userId);
    if (error) throw error;
    clearProfileCache();
}

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

export async function purchaseAutoSignCard(userId, candyCost) {
    const sb = getSupabase();
    const { error: upsertError } = await sb.from('user_auto_sign_card').upsert({ user_id: userId, owned: true }, { onConflict: 'user_id' });
    if (upsertError) throw new Error(upsertError.message);
    const newCandy = (window.userStats?.candy_crumbles || 0) - candyCost;
    await sb.from('user_stats').update({ candy_crumbles: newCandy }).eq('user_id', userId);
    clearProfileCache();
    return newCandy;
}

// ========== 头像框 ==========
export async function loadUserFrames(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_profiles').select('owned_frames, equipped_frame').eq('id', userId).maybeSingle();
    if (error || !data) return { owned: ['nature'], equipped: 'nature' };
    let owned = data.owned_frames || ['nature'];
    if (!owned.includes('nature')) owned.push('nature');
    let equipped = data.equipped_frame || 'nature';
    return { owned, equipped };
}

export async function ensureUserFrameFields(userId) {
    const sb = getSupabase();
    const { data: profile } = await sb.from('user_profiles').select('owned_frames, equipped_frame').eq('id', userId).maybeSingle();
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