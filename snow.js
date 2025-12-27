// 1. 重新定义雪花样式，避免被遮挡
const style = document.createElement('style');
style.innerHTML = `
  @keyframes snowfall {
    0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
  }
  .snowflake {
    position: fixed; /* 改为fixed，跟随视口滚动 */
    top: -10px;
    background: #ffffff; /* 白色雪花适配深色背景 */
    border-radius: 50%;
    opacity: 0.9;
    pointer-events: none;
    z-index: 99999; /* 提高层级，避免被页面元素遮挡 */
  }
`;
document.head.appendChild(style);

// 2. 生成雪花函数，增加随机偏移
function createSnowflake() {
  const snow = document.createElement('div');
  snow.classList.add('snowflake');
  
  // 增大雪花尺寸，更易看见
  const size = Math.random() * 6 + 3 + 'px';
  snow.style.width = size;
  snow.style.height = size;
  
  // 随机水平位置
  snow.style.left = Math.random() * 100 + 'vw';
  
  // 延长动画时长，雪花飘落更明显
  snow.style.animationDuration = Math.random() * 8 + 5 + 's';
  
  // 随机透明度和偏移
  snow.style.opacity = Math.random() * 0.5 + 0.5;
  snow.style.animation = `snowfall ${snow.style.animationDuration} linear infinite`;

  document.body.appendChild(snow);

  // 动画结束后删除
  setTimeout(() => {
    snow.remove();
  }, parseInt(snow.style.animationDuration) * 1000);
}

// 3. 降低生成频率，避免性能问题
setInterval(createSnowflake, 500);

// 页面加载完成后再启动，确保DOM就绪
window.onload = () => {
  setInterval(createSnowflake, 500);
};
