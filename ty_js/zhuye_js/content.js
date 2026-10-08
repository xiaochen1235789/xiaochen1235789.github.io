// =========================================================
// 区域懒加载与数据渲染
// =========================================================
function renderCards(items, containerId, typeLabel, extraClass = '', isMaterial = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const RARITY_LABEL = { 1: '灰', 2: '绿', 3: '蓝', 4: '紫', 5: '金' };

    items.forEach(item => {
        const card = document.createElement('div');
        let classNames = 'content-card';
        if (extraClass) classNames += ' ' + extraClass;
        if (isMaterial && item.rarity) classNames += ` material-${item.rarity}`;
        const rarity = normalizeRarity(item.rarity);
        if (rarity >= 1 && rarity <= 5) classNames += ` r${rarity}`;
        card.className = classNames;
        card.setAttribute('data-type', typeLabel);
        card.setAttribute('data-name', item.name);
        card.setAttribute('data-desc', item.description || '');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
        const detailUrl = item.detail_url || '#';
        card.onclick = () => jumpToDetail(detailUrl, item.name);
        const imgSrc = item.image_url || '';

        let imgOverlayHtml = '';
        let metaHtml = '';
        if (isMaterial && rarity >= 1) {
            imgOverlayHtml = `<span class="mat-rarity">${RARITY_LABEL[rarity]}</span>`;
        } else {
            const starsHtml = rarity >= 1
                ? `<span class="meta-stars">${'★'.repeat(rarity)}</span>`
                : '';
            const limitedHtml = item.is_limited
                ? `<span class="meta-limited">限定</span>`
                : '';
            if (starsHtml || limitedHtml) {
                metaHtml = `<div class="card-meta">${starsHtml}${limitedHtml}</div>`;
            }
        }

        card.innerHTML = `
            <div class="card-img skeleton">
                <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.name)}"
                     loading="lazy" onload="imageLoaded(this)" onerror="imageError(this)">
                ${imgOverlayHtml}
            </div>
            ${metaHtml}
            <div class="card-name">${escapeHtml(item.name)}</div>
            <div class="card-desc">${escapeHtml(item.description || '')}</div>
        `;
        container.appendChild(card);
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim() !== '') {
        searchInput.dispatchEvent(new Event('input'));
    }
}

async function loadTableData(tableName, containerId, typeLabel, extraClass = '', isMaterial = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!supabaseClient) {
        container.innerHTML = `<div style="text-align:center;color:#f87171;padding:20px;">${typeLabel}加载失败：数据库未连接</div>`;
        return;
    }

    container.innerHTML = Array(6).fill('<div class="content-card skeleton" style="height:200px; background:var(--bg-secondary); border-radius:12px;"></div>').join('');

    const { data, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .order('display_order', { ascending: true });

    if (error) {
        console.error(`${typeLabel}加载失败:`, error);
        container.innerHTML = `<div style="text-align:center;color:#f87171;padding:20px;">${typeLabel}加载失败，请稍后重试</div>`;
        return;
    }
    renderCards(data, containerId, typeLabel, extraClass, isMaterial);
}

function setupLazyLoading(sectionId, containerId, tableName, typeLabel, extraClass = '', isMaterial = false) {
    if (isLoadingLazy[sectionId]) return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            isLoadingLazy[sectionId] = true;
            observer.disconnect();
            loadTableData(tableName, containerId, typeLabel, extraClass, isMaterial);
        }
    }, { threshold: 0.1 });

    observer.observe(section);
}