// 仅保留纯数据，后期可自动化生成
window.SKILL_DATA = {
  普攻: {
    min: 1,
    max: 7,
    default: 7,
    levels: {
      1: { damage: 50 },
      2: { damage: 60 },
      3: { damage: 70 },
      4: { damage: 80 },
      5: { damage: 90 },
      6: { damage: 100 },
      7: { damage: 110 }
    }
  },
  战技: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1: { damage: 150 },
      2: { damage: 170 },
      // … 省略中间
      12: { damage: 370 }
    }
  },
  终结技: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1:  { damage: 300, bonus: 100 },
      12: { damage: 696, bonus: 210 }
    }
  },
  天赋: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1:  { penetration: 3.3 },
      12: { penetration: 4.4 }
    }
  }
};