// ==================== 邮箱角标功能 ====================
async function getUnreadMailCount() {
    if (!supabaseClient || !currentUser) return 0;
    try {
        const { count, error } = await supabaseClient
            .from('user_mails')
            .select('*', { count: 'exact', head: true })
            .eq('to_user_id', currentUser.id)
            .is('read_at', null);
        if (error) {
            console.warn('获取未读邮件数失败:', error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        console.warn('获取未读邮件数异常:', e);
        return 0;
    }
}

async function updateEmailBadge() {
    const badge = document.getElementById('emailBadge');
    if (!badge) return;
    if (!currentUser) {
        badge.textContent = '0';
        badge.style.display = 'none';
        return;
    }
    const count = await getUnreadMailCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function startEmailBadgePolling() {
    if (emailBadgeTimer) {
        clearInterval(emailBadgeTimer);
        emailBadgeTimer = null;
    }
    updateEmailBadge();
    emailBadgeTimer = setInterval(updateEmailBadge, 30000);
}

// ==================== 邮箱模态框控制 ====================
function openEmailModal() {
    const modal = document.getElementById('email-modal');
    const iframe = document.getElementById('emailIframe');
    const errorDiv = document.getElementById('email-error');
    if (!modal || !iframe) return;

    if (modal.classList.contains('active')) {
        closeEmailModal();
        return;
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
    errorDiv.style.display = 'none';
    iframe.style.display = 'block';
    showNotification('正在加载邮箱...', 'info');
    iframe.src = 'email_address.html?embedded=true&t=' + Date.now();

    iframe.onload = function() {
        showNotification('邮箱已加载', 'success');
        errorDiv.style.display = 'none';
        iframe.style.display = 'block';
        setTimeout(updateEmailBadge, 1000);
    };
    iframe.onerror = function() {
        iframe.style.display = 'none';
        errorDiv.style.display = 'block';
        showNotification('加载邮箱失败', 'error');
    };
}

function closeEmailModal() {
    const modal = document.getElementById('email-modal');
    if (!modal || !modal.classList.contains('active')) return;

    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => {
        const iframe = document.getElementById('emailIframe');
        if (iframe) iframe.src = 'about:blank';
        updateEmailBadge();
    }, 300);
}

function reloadEmailIframe() {
    const iframe = document.getElementById('emailIframe');
    const errorDiv = document.getElementById('email-error');
    if (!iframe) return;
    errorDiv.style.display = 'none';
    iframe.style.display = 'block';
    iframe.src = 'email_address.html?embedded=true&t=' + Date.now();
    showNotification('重新加载中...', 'info');
}