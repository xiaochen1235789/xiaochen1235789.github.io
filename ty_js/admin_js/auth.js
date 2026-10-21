// ========== 认证与权限管理 ==========
import { SUPABASE_URL, SUPABASE_KEY, OWNER_ID } from './config.js';
import { showNotification } from './utils.js';

let supabaseAdmin = null;
let currentUser = null;
let currentUserRole = null;
let currentUsername = null;

// 将当前管理员信息挂载到 window，供 utils.logAction 使用
window.__currentAdmin = null;

// ----- 初始化 Supabase -----
export function initSupabase() {
    if (!supabaseAdmin) {
        supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseAdmin = supabaseAdmin;
    }
    return supabaseAdmin;
}

export function getSupabase() {
    if (!supabaseAdmin) initSupabase();
    return supabaseAdmin;
}

// ----- 认证与角色校验（后台入口） -----
export async function checkAuthAndRole() {
    const sb = initSupabase();
    
    // 1. 获取当前用户
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) {
        showNotification('请先登录', 'error');
        setTimeout(() => window.location.href = '/login-real.html', 1500);
        return false;
    }
    currentUser = user;
    window.__currentAdmin = { id: user.id, email: user.email, role: null };

    // 2. 确定角色
    // ★ 移除原来的 `update({ role: 'owner' })`：
    //   a) 每次进后台都往库里写一次，纯属浪费；
    //   b) role 列现在不允许前端写，这句必然失败（虽然不致命）；
    //   c) 2e617135 的 role 本来就是 owner，不需要"自动修复"。
    //   现在统一从数据库读，并额外取一个服务端判定的 tier，便于排查。
    {
        const { data: profile, error: profileErr } = await sb.from('user_profiles')
            .select('role, username')
            .eq('id', user.id)
            .single();

        if (profileErr) {
            console.warn('读取资料失败:', profileErr.message);
        }

        currentUserRole = profile?.role || 'user';
        currentUsername = profile?.username || user.email?.split('@')[0] || '用户';

        // 让后端告诉我们"你实际能干什么"，避免前后端判断不一致
        try {
            const { data: tier } = await sb.rpc('actor_tier');
            window.__currentAdmin.tier = tier || null;
        } catch (e) {
            window.__currentAdmin.tier = null;
        }
    }
    window.__currentAdmin.role = currentUserRole;

    // 3. 权限判断（只允许站长和管理员）
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
        showNotification('无权限访问管理后台', 'error');
        setTimeout(() => window.location.href = '/index.html', 1500);
        return false;
    }

    // 4. 显示管理员名称（仅用户名，不含邮箱）
    const displayEl = document.getElementById('adminUserDisplay');
    if (displayEl) {
        displayEl.innerText = currentUsername;
    }

    return true;
}

// ----- 导出当前用户信息 -----
export { supabaseAdmin, currentUser, currentUserRole, currentUsername };