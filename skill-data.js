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
      3：{ damage：190 },
      4：{ damage：210 },
      5：{ damage：230 },
      6：{ damage：250 },
      7：{ damage：270 },
      8：{ damage：290 },
      9：{ damage：310 },
      10：{ damage：330 },
      11：{ damage：350 },
      12: { damage: 370 }
    }
  },
  终结技: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1:  { damage: 300, bonus: 100 },
      2:  { damage: 336, bonus: 110 },
      3:  { damage: 372, bonus: 120 },
      4:  { damage: 408, bonus: 130 },
      5:  { damage: 444, bonus: 140 },
      6:  { damage: 480, bonus: 150 },
      7:  { damage: 516, bonus: 160 },
      8:  { damage: 552, bonus: 170 },
      9:  { damage: 588, bonus: 180 },
      10:  { damage: 624, bonus: 190 },
      11:  { damage: 660, bonus: 200 },
      12: { damage: 696, bonus: 210 }
    }
  },
  天赋: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1:  { penetration: 3.3 },
      2:  { penetration: 3.4 },
      3:  { penetration: 3.5 },
      4:  { penetration: 3.6 },
      5:  { penetration: 3.7 },
      6:  { penetration: 3.8 },
      7:  { penetration: 3.9 },
      8:  { penetration: 4.0 },
      9:  { penetration: 4.1 },
      10:  { penetration: 4.2 },
      11:  { penetration: 4.3 },
      12: { penetration: 4.4 }
    }
  }
};
