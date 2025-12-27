// 1. 雪花样式（确保优先级高于页面其他样式）
const snowStyle = document.createElement('style');
snowStyle.innerHTML = `
  @keyframes snowfall {
    0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
    10% { opacity: 0.85; }
    90% { opacity: 0.85; }
    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
  }
  .snowflake {
    position: fixed !important; /* 强制固定定位，避免被页面元素影响 */
    top: -10px;
    background: #ffffff;
    border-radius: 50%;
    pointer-events: none;
    z-index: 99999 !important; /* 最高层级，确保不被遮挡 */
  }
`;
document.head.appendChild(snowStyle);

// 2. 生成雪花函数（独立执行，不依赖外部事件）
function createSnow() {
  const snow = document.createElement('div');
  snow.classList.add('snowflake');
  
  // 随机雪花大小（3-8px，避免过大影响视觉）
  const size = Math.random() * 5 + 3 + 'px';
  snow.style.width = size;
  snow.style.height = size;
  
  // 随机水平位置（覆盖整个页面）
  snow.style.left = Math.random() * 100 + 'vw';
  
  // 随机飘落时长（6-12秒，模拟自然速度）
  const duration = Math.random() * 6 + 6 + 's';
  snow.style.animation = `snowfall ${duration} linear infinite`;
  
  // 随机透明度（0.6-0.9，增加层次感）
  snow.style.opacity = Math.random() * 0.3 + 0.6;

  // 确保body存在后再挂载（避免DOM未加载的错误）
  if (document.body) {
    document.body.appendChild(snow);
    // 动画结束后删除雪花，释放内存
    setTimeout(() => snow.remove(), parseFloat(duration) * 1000);
  }
}

// 3. 立即启动雪花生成（每500ms生成一片，平衡效果与性能）
setInterval(createSnow, 500);
// 初始额外生成20片，避免启动时雪花过少
for (let i = 0; i < 20; i++) {
  setTimeout(createSnow, i * 100); // 错开生成时间，更自然
}

