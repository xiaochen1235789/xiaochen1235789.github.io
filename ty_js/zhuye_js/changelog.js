// ==================== 更新日志弹窗 ====================
function openChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    const iframe = document.getElementById('changelog-iframe');
    const errorDiv = document.getElementById('changelog-error');
    if (!modal || !iframe) return;
    if (modal.style.display === 'flex' && !modal.classList.contains('closing')) return;
    modal.classList.remove('closing');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    errorDiv.style.display = 'none';
    iframe.style.display = 'block';
    showNotification('正在加载更新日志...', 'info');
    iframe.src = 'changelog.html?t=' + Date.now();

    iframe.onload = function() {
        showNotification('更新日志已加载', 'success');
        errorDiv.style.display = 'none';
        iframe.style.display = 'block';
    };
    iframe.onerror = function() {
        iframe.style.display = 'none';
        errorDiv.style.display = 'block';
        showNotification('加载更新日志失败', 'error');
    };
}

function closeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
        document.body.classList.remove('modal-open');
        const iframe = document.getElementById('changelog-iframe');
        if (iframe) iframe.src = 'about:blank';
    }, 300);
}

// 全局按键 & iframe 消息监听
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChangelogModal(); });
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'closeModal') closeChangelogModal();
});