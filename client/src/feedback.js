// 星级与鼓励语库
export const STAR_PRAISE = {
  3: [
    '太厉害啦！完美通关，你就是编程小天才！🌟',
    '哇！三颗星！你的程序又短又聪明！🎉',
    '满分表现！循环和条件被你玩明白了！🏆',
    '不可思议！这么少的积木就过关了，给你点赞！👍',
  ],
  2: [
    '很棒哦！成功到达终点！再试试能不能用更少的积木拿满星？💪',
    '干得漂亮！离三颗星只差一点点，优化一下程序吧！✨',
    '通关啦！想想哪里可以用循环让程序更短？🔁',
  ],
  1: [
    '成功啦！第一次走通就值得表扬！继续挑战更高星级吧！🌈',
    '不错不错，你做到了！多试几次，程序会越来越短哦。🌱',
  ],
};

export const FAIL_FEEDBACK = {
  wall: '哎呀，机器人撞到墙了！🤕 看看是哪一步走的方向不对，试试加一个“转弯”或者“如果前面是墙”的判断吧。',
  goals: '机器人到达终点啦，但路上还有 ⭐ 没收集到！改改路线，把星星都收入囊中吧。',
  notFinish: '程序执行完了，可机器人还没到达小旗子 🚩。检查一下是不是少走了几步，或者转弯方向反了？',
  empty: '程序区还是空的哦～从左边拖几块积木进来，再点运行吧！',
  programTooLong: '程序跑得太久啦，检查一下循环次数是不是太大了。',
};

export function praiseFor(stars) {
  const arr = STAR_PRAISE[stars] || STAR_PRAISE[1];
  return arr[Math.floor(Math.random() * arr.length)];
}
export function failMsgFor(reason) {
  return FAIL_FEEDBACK[reason] || '再检查一下你的程序，你一定可以的！';
}
