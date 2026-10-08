// ==================== 用户认证 ====================
async function refreshUserState() {
    if (!supabaseClient) return;
    try {
        const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
        if (sessionErr || !session || !session.user) {
            if (currentUser) {
                currentUser = null;
                userStats = null;
                updateNavbar(null);
                updateMenuUserInfo(null);
                updateAutoSignCardStatusUI();
                updateEmailBadge();
            }
            return;
        }
        currentUser = session.user;
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('username, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();
        if (profile) {
            const username = profile.username || currentUser.email.split('@')[0];
            localStorage.setItem('cachedUsername', username);
            if (profile.avatar_url) localStorage.setItem('cachedAvatar', profile.avatar_url);
            updateNavbar(username, profile.avatar_url);
            updateMenuUserInfo(username, profile.avatar_url, currentUser.email);
            const { data: stats } = await supabaseClient
                .from('user_stats')
                .select('*')
                .eq('user_id', currentUser.id)
                .maybeSingle();
            if (stats) {
                userStats = stats;
                localStorage.setItem('cachedUserStats', JSON.stringify(stats));
            }
        } else {
            updateNavbar(currentUser.email.split('@')[0], null);
            updateMenuUserInfo(currentUser.email.split('@')[0], null, currentUser.email);
        }
        await updateAutoSignCardStatusUI();
        await updateEmailBadge();
    } catch (err) {
        console.warn('refreshUserState error:', err);
        showNotification('用户状态刷新失败，请重试', 'error');
    }
}

async function initializeUserProfile() {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        await refreshUserState();
        if (currentUser && userStats) {
            await tryAutoSign();
        }
        startEmailBadgePolling();
    } catch (error) {
        console.error('用户初始化失败:', error);
        showNotification('用户初始化失败，部分功能可能受限', 'error');
    }
}

// ==================== 导航栏渲染 ====================
function updateNavbar(username, avatarUrl) {
    const userNavSection = document.getElementById('userNavSection');
    if (!userNavSection) return;
    const dropdown = document.getElementById('userDropdown');

    if (username) {
        const safeUsername = escapeHtml(username);
        const avatarLetter = safeUsername.charAt(0).toUpperCase();
        let avatarHtml = '';
        if (avatarUrl) {
            avatarHtml =
                `<img src="${escapeHtml(avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3ecf8e,#8a4baf);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;\\'>${avatarLetter}</div>';">`;
        } else {
            avatarHtml =
                `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3ecf8e,#8a4baf);display:flex;align-items:center;justify-content:center;color:white;font-weight:600;">${avatarLetter}</div>`;
        }
        userNavSection.innerHTML = `
                <div class="user-menu-trigger" id="userMenuTrigger">
                    ${avatarHtml}
                    <span>${safeUsername}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.8rem;"></i>
                </div>
            `;

        if (dropdown) {
            dropdown.style.display = '';
            dropdown.classList.remove('show');
        }

        const trigger = document.getElementById('userMenuTrigger');
        if (trigger && !trigger._listenerAdded) {
            trigger.addEventListener('click', function(e) {
                e.stopPropagation();
                if (dropdown) {
                    const rect = this.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                    dropdown.style.top = (rect.bottom + scrollTop + 8) + 'px';
                    dropdown.style.right = (window.innerWidth - rect.right + scrollLeft) + 'px';
                    dropdown.classList.toggle('show');
                }
            });
            trigger._listenerAdded = true;
        }
        if (!window._closeMenuBound) {
            const closeMenuHandler = function(e) {
                const trigger = document.getElementById('userMenuTrigger');
                if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            };
            document.addEventListener('click', closeMenuHandler);
            window.addEventListener('scroll', closeMenuHandler);
            window.addEventListener('resize', closeMenuHandler);
            window._closeMenuBound = true;
        }
    } else {
        userNavSection.innerHTML = `<a href="login-real.html" class="nav-link" id="loginLink">登录/注册</a>`;
        if (dropdown) {
            dropdown.classList.remove('show');
            dropdown.style.display = 'none';
        }
    }
}

function updateMenuUserInfo(username, avatarUrl, email) {
    const menuAvatar = document.getElementById('menuAvatar');
    const menuUsername = document.getElementById('menuUsername');
    const menuEmail = document.getElementById('menuEmail');
    if (!menuAvatar || !menuUsername || !menuEmail) return;
    if (username) {
        const avatarLetter = username.charAt(0).toUpperCase();
        if (avatarUrl) {
            menuAvatar.innerHTML =
                `<img src="${escapeHtml(avatarUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            menuAvatar.innerHTML =
                `<div class="avatar-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${avatarLetter}</div>`;
        }
        menuUsername.textContent = username;
        menuEmail.textContent = email || '';
        menuAvatar.style.cursor = 'pointer';
        menuAvatar.onclick = () => window.open('profile.html', '_blank');
    } else {
        menuAvatar.innerHTML =
            `<div class="avatar-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">U</div>`;
        menuUsername.textContent = '未登录';
        menuEmail.textContent = '点击登录';
        menuAvatar.onclick = () => window.location.href = 'login-real.html';
    }
}

// ==================== 模态框管理 ====================
function closeAllModals() {
    document.querySelectorAll('.modal-mask.active').forEach(el => el.classList.remove('active'));
}

// ==================== 用户菜单动作绑定 ====================
function bindUserMenuActions() {
    const signinItem = document.getElementById('dailySigninItem');
    const logoutItem = document.getElementById('logoutItem');
    const signinModal = document.getElementById('signinModal');
    const logoutModal = document.getElementById('logoutModal');
    const confirmSignin = document.getElementById('confirmSigninBtn');
    const cancelSignin = document.getElementById('cancelSigninBtn');
    const confirmLogout = document.getElementById('confirmLogoutBtn');
    const cancelLogout = document.getElementById('cancelLogoutBtn');

    if (signinItem) {
        signinItem.onclick = async (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.remove('show');
            if (!currentUser) {
                showNotification('请先登录', 'error');
                return;
            }
            closeAllModals();
            const nextStreak = (userStats?.checkin_streak || 0) + 1;
            const reward = await fetchCheckinReward(nextStreak);
            const previewText =
                `签到可获得 🍬${reward.candy.toLocaleString()} ${reward.rainbow>0?`🌈${reward.rainbow} `:''}⚡${reward.active.toLocaleString()}`;
            document.getElementById('signinRewardPreview').innerHTML = previewText;

            const today = getLocalDateString();
            const alreadyChecked = userStats?.last_checkin_date === today;
            if (alreadyChecked) {
                confirmSignin.textContent = '今日已签到';
                confirmSignin.style.background = '#6b7280';
                confirmSignin.style.cursor = 'default';
                confirmSignin.style.opacity = '0.8';
            } else {
                confirmSignin.textContent = '签到';
                confirmSignin.style.background = '';
                confirmSignin.style.cursor = 'pointer';
                confirmSignin.style.opacity = '1';
            }
            signinModal.classList.add('active');
        };
    }
    if (confirmSignin) {
        confirmSignin.onclick = async () => {
            signinModal.classList.remove('active');
            await performCheckin();
        };
    }
    if (cancelSignin) {
        cancelSignin.onclick = () => signinModal.classList.remove('active');
    }
    if (logoutItem) {
        logoutItem.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.remove('show');
            if (!currentUser) {
                showNotification('未登录', 'error');
                return;
            }
            closeAllModals();
            logoutModal.classList.add('active');
        };
    }
    if (confirmLogout) {
        confirmLogout.onclick = async () => {
            logoutModal.classList.remove('active');
            if (supabaseClient) await supabaseClient.auth.signOut();
            localStorage.removeItem('cachedUsername');
            localStorage.removeItem('cachedAvatar');
            localStorage.removeItem('cachedUserProfile');
            localStorage.removeItem('cachedUserStats');
            currentUser = null;
            userStats = null;
            updateNavbar(null);
            updateMenuUserInfo(null);
            updateAutoSignCardStatusUI();
            updateEmailBadge();
            showNotification('已退出登录', 'success');
            setTimeout(() => window.location.reload(), 500);
        };
    }
    if (cancelLogout) {
        cancelLogout.onclick = () => logoutModal.classList.remove('active');
    }
    document.querySelectorAll('.modal-mask').forEach(mask => {
        mask.addEventListener('click', (e) => {
            if (e.target === mask) mask.classList.remove('active');
        });
    });
}

// ==================== 登录消息监听 ====================
function setupLoginMessageListener() {
    window.addEventListener('message', (event) => {
        if (event.data === 'login_success') {
            refreshUserState();
            showNotification('登录成功', 'success');
        }
    });
}

// ==================== 跨页签同步 ====================
function setupCrossTabSync() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'cachedUsername' || e.key === 'cachedAvatar') {
            refreshUserState();
        }
        if (e.key === 'forceRefreshUserState') {
            refreshUserState();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshUserState();
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) refreshUserState();
    });
}