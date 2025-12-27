// 1. 自动添加 CSS 样式
const style = document.createElement('style');
style.innerHTML = `
  @keyframes snowfall {
    0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
  }
  .snowflake {
    position: absolute;
    top: -10px;
    background: white;
    border-radius: 50%;
    opacity: 0.8;
    pointer-events: none;
    z-index: 1000;
  }
`;
document.head.appendChild(style);

// 2. 生成雪花的函数
function createSnowflake() {
  const snow = document.createElement('div');
  snow.classList.add('snowflake');
  
  // 随机大小
  const size = Math.random() * 4 + 2 + 'px';
  snow.style.width = size;
  snow.style.height = size;
  
  // 随机位置
  snow.style.left = Math.random() * 100 + 'vw';
  
  // 随机动画时长
  snow.style.animationDuration = Math.random() * 3 + 2 + 's';
  
  document.body.appendChild(snow);

  // 动画结束后删除元素，防止内存泄漏
  setTimeout(() => {
    snow.remove();
  }, 5000);
}

// 3. 启动定时器，每隔一段时间生成一片雪花
setInterval(createSnowflake, 300);
