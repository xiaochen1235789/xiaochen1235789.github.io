// 1. 雪花样式优化，适配深色背景+最高层级
const style = document.createElement('style');
style.innerHTML = `
  @keyframes snowfall {
    0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
  }
  .snowflake {
    position: fixed;
    top: -10px;
    background: #ffffff;
    border-radius: 50%;
    opacity: 0.85;
    pointer-events: none;
    z-index: 99999; /* 高于页面所有元素，避免被遮挡 */
  }
`;
document.head.appendChild(style);

// 2. 生成雪花函数，优化飘落流畅度
function createSnowflake() {
  const snow = document.createElement('div');
  snow.classList.add('snowflake');
  
  // 随机雪花大小（3-9px），避免过大影响视觉
  const size = Math.random() * 6 + 3 + 'px';
  snow.style.width = size;
  snow.style.height = size;
  
  // 随机水平位置，覆盖整个页面
  snow.style.left = Math.random() * 100 + 'vw';
  
  // 随机飘落时长（5-13秒），模拟自然飘落
  const duration = Math.random() * 8 + 5 + 's';
  snow.style.animation = `snowfall ${duration} linear infinite`;
  
  // 随机透明度（0.5-0.9），增加层次感
  snow.style.opacity = Math.random() * 0.4 + 0.5;

  document.body.appendChild(snow);

  // 动画结束后删除雪花，释放内存（避免性能占用）
  setTimeout(() => {
    snow.remove();
  }, parseFloat(duration) * 1000);
}

// 3. 页面完全加载后启动雪花，每600ms生成一片（平衡效果与性能）
window.onload = () => {
  setInterval(createSnowflake, 600);
};

