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
    if (user.id === OWNER_ID) {
        await sb.from('user_profiles').update({ role: 'owner' }).eq('id', OWNER_ID);
        currentUserRole = 'owner';
        currentUsername = '站长';
    } else {
        const { data: profile } = await sb.from('user_profiles')
            .select('role, username')
            .eq('id', user.id)
            .single();
        currentUserRole = profile?.role || 'user';
        currentUsername = profile?.username || user.email?.split('@')[0] || '用户';
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