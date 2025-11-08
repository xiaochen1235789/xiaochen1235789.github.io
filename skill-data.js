// 仅保留纯数据，后期可自动化生成
window.SKILL_DATA = {
  普攻: {
    min: 1,
    max: 7,
    default: 7,
    levels: {
      1: { 对指定敌方单体造成等同于鹿管"50%"攻击力的风属性伤害 },
      2: { 对指定敌方单体造成等同于鹿管"60%"攻击力的风属性伤害 },
      3: { 对指定敌方单体造成等同于鹿管"70%"攻击力的风属性伤害 },
      4: { 对指定敌方单体造成等同于鹿管"80%"攻击力的风属性伤害 },
      5: { 对指定敌方单体造成等同于鹿管"90%"攻击力的风属性伤害 },
      6: { 对指定敌方单体造成等同于鹿管"100%"攻击力的风属性伤害 },
      7: { 对指定敌方单体造成等同于鹿管"110%"攻击力的风属性伤害 },
    }
  },
  战技: {
    min: 1,
    max: 12,
    default: 12,
    levels: {
      1: { damage: 150 },
      2: { damage: 170 },
      3: { damage: 190 }, // 修正中文冒号为英文冒号
      4: { damage: 210 },
      5: { damage: 230 },
      6: { damage: 250 },
      7: { damage: 270 },
      8: { damage: 290 },
      9: { damage: 310 },
      10: { damage: 330 },
      11: { damage: 350 },
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
