// ==================== 搜索功能 ====================
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const emptyResult = document.querySelector('.empty-result');
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && !document.querySelector('.search-clear')) {
        const clearBtn = document.createElement('span');
        clearBtn.className = 'search-clear';
        clearBtn.innerHTML = '✕';
        clearBtn.style.cssText = 'position:absolute; right:44px; top:50%; transform:translateY(-50%); cursor:pointer; color:#8a9bb5; display:none; font-size:1rem;';
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            clearBtn.style.display = 'none';
            searchInput.focus();
        });
        searchContainer.style.position = 'relative';
        searchContainer.appendChild(clearBtn);
        searchInput.addEventListener('input', () => {
            clearBtn.style.display = searchInput.value ? 'block' : 'none';
        });
    }
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const keyword = this.value.trim().toLowerCase();
            const activeSection = document.querySelector('.content-section.active');
            if (!activeSection) return;
            const cards = activeSection.querySelectorAll('.content-card');
            let matchCount = 0;
            cards.forEach(card => {
                const name = card.dataset.name?.toLowerCase() || '';
                const desc = card.dataset.desc?.toLowerCase() || '';
                const isMatch = !keyword || name.includes(keyword) || desc.includes(keyword);
                card.style.display = isMatch ? '' : 'none';
                if (isMatch) matchCount++;
            });
            if (matchCount === 0 && keyword) {
                emptyResult.style.display = 'block';
                emptyResult.querySelector('h3').textContent = '当前分类未找到匹配结果';
            } else {
                emptyResult.style.display = 'none';
            }
        }, 200);
    });
}