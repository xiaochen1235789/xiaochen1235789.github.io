// ==================== 站长留言模态框控制 ====================
function openOwnerMessage() {
    closeAllModals();
    document.getElementById('ownerMessageModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeOwnerMessage() {
    document.getElementById('ownerMessageModal').classList.remove('active');
    document.body.style.overflow = '';
}

// 暴露给全局（HTML 里 onclick 会调用）
window.closeOwnerMessage = closeOwnerMessage;
window.openOwnerMessage = openOwnerMessage;