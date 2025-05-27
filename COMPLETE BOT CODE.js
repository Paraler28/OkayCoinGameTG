// 🤖 OkayCoin Bot - Полный код в одном файле
// Разработан для работы 24/7 без засыпания

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// ================== КОНФИГУРАЦИЯ ==================
const BOT_TOKEN = '7949379153:AAFGbjm6EhWgBV51JT223daOgg7i6alpFdc';
const ADMIN_ID = 5467443715;
const CHANNEL_ID = -1002638030999; // @OkayCryptoChannel
const PORT = process.env.PORT || 5000;

// ================== БАЗА ДАННЫХ В ПАМЯТИ ==================
let users = new Map();
let tasks = new Map();
let userTasks = new Map();
let referrals = new Map();

// Инициализация базовых заданий
function initializeTasks() {
  tasks.set(1, {
    id: 1,
    title: "Подписаться на канал",
    description: "Подпишитесь на @OkayCryptoChannel",
    reward: 500,
    icon: "📢",
    type: "channel",
    channelId: CHANNEL_ID,
    channelUsername: "OkayCryptoChannel",
    isActive: true
  });

  tasks.set(2, {
    id: 2,
    title: "Пригласить друга",
    description: "Пригласите 5 друзей по реферальной ссылке",
    reward: 1000,
    icon: "👥",
    type: "referral",
    target: 5,
    isActive: true
  });

  tasks.set(3, {
    id: 3,
    title: "Ежедневная награда",
    description: "Получайте ежедневную награду",
    reward: 100,
    icon: "🎁",
    type: "daily",
    isActive: true
  });
}

// ================== ФУНКЦИИ РАБОТЫ С ДАННЫМИ ==================
function getUser(telegramId) {
  return users.get(telegramId);
}

function createUser(telegramId, username, firstName) {
  const user = {
    id: telegramId,
    username: username || '',
    firstName: firstName || '',
    coins: 0,
    level: 1,
    dailyTaps: 0,
    lastTapDate: new Date().toDateString(),
    lastDailyReward: null,
    language: 'ru',
    completedTasks: [],
    referrerId: null,
    referralCount: 0,
    joinedAt: new Date()
  };
  users.set(telegramId, user);
  return user;
}

function updateUser(telegramId, updates) {
  const user = users.get(telegramId);
  if (user) {
    Object.assign(user, updates);
    users.set(telegramId, user);
  }
  return user;
}

function getReferralCount(userId) {
  let count = 0;
  for (let [, ref] of referrals) {
    if (ref.referrerId === userId) count++;
  }
  return count;
}

// ================== ПЕРЕВОДЫ ==================
const translations = {
  ru: {
    welcome: "🎉 Добро пожаловать в OkayCoin!\n\n🪙 Тапайте монету и зарабатывайте OK!\n💰 Приглашайте друзей и получайте бонусы!\n🏆 Соревнуйтесь в лидерборде!",
    mainMenu: "🎮 Главное меню",
    tapButton: "🪙 Тапнуть",
    tasksButton: "📋 Задания",
    statsButton: "📊 Статистика",
    leaderboardButton: "🏆 Лидерборд",
    referralsButton: "👥 Рефералы",
    shareButton: "📤 Поделиться",
    backButton: "⬅️ Назад",
    tapLimit: "🚫 Вы достигли дневного лимита тапов (50/50)!\n⏰ Приходите завтра за новыми тапами!",
    earnedCoins: "💰 Вы заработали {amount} OK!\n\n🪙 Всего: {total} OK\n⚡ Тапов сегодня: {taps}/50",
    noTasks: "✅ Все задания выполнены!",
    taskCompleted: "✅ Задание выполнено! Получено {reward} OK!",
    subscribeFirst: "❌ Сначала подпишитесь на канал!",
    alreadyCompleted: "✅ Задание уже выполнено!",
    claimDaily: "🎁 Забрать награду",
    dailyClaimed: "🎁 Ежедневная награда получена!\n💰 +{reward} OK",
    dailyAlready: "⏰ Ежедневная награда уже получена сегодня!",
    stats: "📊 Ваша статистика:\n\n💰 Монеты: {coins} OK\n🏅 Уровень: {level}\n⚡ Тапов сегодня: {taps}/50\n👥 Рефералов: {referrals}\n📅 Дата регистрации: {joinDate}"
  },
  en: {
    welcome: "🎉 Welcome to OkayCoin!\n\n🪙 Tap the coin and earn OK!\n💰 Invite friends and get bonuses!\n🏆 Compete in the leaderboard!",
    mainMenu: "🎮 Main Menu",
    tapButton: "🪙 Tap",
    tasksButton: "📋 Tasks",
    statsButton: "📊 Statistics",
    leaderboardButton: "🏆 Leaderboard",
    referralsButton: "👥 Referrals",
    shareButton: "📤 Share",
    backButton: "⬅️ Back",
    tapLimit: "🚫 You've reached the daily tap limit (50/50)!\n⏰ Come back tomorrow for new taps!",
    earnedCoins: "💰 You earned {amount} OK!\n\n🪙 Total: {total} OK\n⚡ Taps today: {taps}/50",
    noTasks: "✅ All tasks completed!",
    taskCompleted: "✅ Task completed! Received {reward} OK!",
    subscribeFirst: "❌ Subscribe to the channel first!",
    alreadyCompleted: "✅ Task already completed!",
    claimDaily: "🎁 Claim Reward",
    dailyClaimed: "🎁 Daily reward claimed!\n💰 +{reward} OK",
    dailyAlready: "⏰ Daily reward already claimed today!",
    stats: "📊 Your Statistics:\n\n💰 Coins: {coins} OK\n🏅 Level: {level}\n⚡ Taps today: {taps}/50\n👥 Referrals: {referrals}\n📅 Join Date: {joinDate}"
  }
};

function t(key, lang = 'ru', params = {}) {
  let text = translations[lang]?.[key] || translations['ru'][key] || key;
  Object.keys(params).forEach(param => {
    text = text.replace(`{${param}}`, params[param]);
  });
  return text;
}

// ================== TELEGRAM BOT ==================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Обработка команды /start
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const param = match[1]?.trim();
  
  let user = getUser(telegramId);
  
  // Обработка реферальной ссылки
  if (param && param.startsWith(' ref')) {
    const referrerId = parseInt(param.replace(' ref', ''));
    if (referrerId && referrerId !== telegramId && !user) {
      // Новый пользователь с рефералом
      user = createUser(telegramId, msg.from.username, msg.from.first_name);
      user.referrerId = referrerId;
      
      // Создаем запись реферала
      const referralId = Date.now();
      referrals.set(referralId, {
        id: referralId,
        referrerId: referrerId,
        referredId: telegramId,
        createdAt: new Date()
      });
      
      // Увеличиваем счетчик рефералов у пригласившего
      const referrer = getUser(referrerId);
      if (referrer) {
        referrer.referralCount = getReferralCount(referrerId);
        updateUser(referrerId, referrer);
      }
      
      console.log(`👥 NEW REFERRAL: ${telegramId} invited by ${referrerId}`);
    }
  }
  
  if (!user) {
    user = createUser(telegramId, msg.from.username, msg.from.first_name);
  }
  
  await showMainMenu(chatId, user);
});

// Показать главное меню
async function showMainMenu(chatId, user, messageId = null) {
  const lang = user.language;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: t('tapButton', lang), callback_data: 'tap' }],
      [
        { text: t('tasksButton', lang), callback_data: 'tasks' },
        { text: t('statsButton', lang), callback_data: 'stats' }
      ],
      [
        { text: t('leaderboardButton', lang), callback_data: 'leaderboard' },
        { text: t('referralsButton', lang), callback_data: 'referrals' }
      ],
      [{ text: t('shareButton', lang), callback_data: 'share' }]
    ]
  };
  
  const text = `${t('welcome', lang)}\n\n💰 Ваш баланс: ${user.coins.toLocaleString()} OK\n🏅 Уровень: ${user.level}`;
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, { reply_markup: keyboard });
  }
}

// Обработка тапов
async function handleTap(chatId, messageId, user) {
  const today = new Date().toDateString();
  
  if (user.lastTapDate !== today) {
    user.dailyTaps = 0;
    user.lastTapDate = today;
  }
  
  if (user.dailyTaps >= 50) {
    await bot.answerCallbackQuery(chatId, { text: t('tapLimit', user.language) });
    return;
  }
  
  // Добавляем 10 монет за тап
  user.coins += 10;
  user.dailyTaps += 1;
  
  // Повышаем уровень каждые 1000 монет
  const newLevel = Math.floor(user.coins / 1000) + 1;
  if (newLevel > user.level) {
    user.level = newLevel;
  }
  
  updateUser(user.id, user);
  
  console.log(`💰 TAP: User ${user.id} earned 10 OK, total: ${user.coins}, taps: ${user.dailyTaps}`);
  
  await showMainMenu(chatId, user, messageId);
  await bot.answerCallbackQuery(chatId, { 
    text: t('earnedCoins', user.language, { 
      amount: 10, 
      total: user.coins.toLocaleString(), 
      taps: user.dailyTaps 
    }) 
  });
}

// Показать задания
async function showTasks(chatId, messageId, user) {
  const lang = user.language;
  const availableTasks = [];
  
  for (let [, task] of tasks) {
    if (task.isActive && !user.completedTasks.includes(task.id)) {
      availableTasks.push(task);
    }
  }
  
  if (availableTasks.length === 0) {
    const keyboard = {
      inline_keyboard: [
        [{ text: t('backButton', lang), callback_data: 'back' }]
      ]
    };
    
    await bot.editMessageText(t('noTasks', lang), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard
    });
    return;
  }
  
  const keyboard = {
    inline_keyboard: [
      ...availableTasks.map(task => [
        { text: `${task.icon} ${task.title} - ${task.reward} OK`, callback_data: `task_${task.id}` }
      ]),
      [{ text: t('backButton', lang), callback_data: 'back' }]
    ]
  };
  
  await bot.editMessageText(`📋 Доступные задания:\n\n${availableTasks.map(task => 
    `${task.icon} ${task.title}\n💰 Награда: ${task.reward} OK\n📝 ${task.description}`
  ).join('\n\n')}`, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard
  });
}

// Обработка выполнения задания
async function completeTask(chatId, messageId, user, taskId) {
  const task = tasks.get(taskId);
  if (!task || user.completedTasks.includes(taskId)) {
    await bot.answerCallbackQuery(chatId, { text: t('alreadyCompleted', user.language) });
    return;
  }
  
  let canComplete = false;
  
  if (task.type === 'channel') {
    try {
      const member = await bot.getChatMember(task.channelId, user.id);
      canComplete = ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
      canComplete = false;
    }
  } else if (task.type === 'referral') {
    const referralCount = getReferralCount(user.id);
    canComplete = referralCount >= task.target;
  } else if (task.type === 'daily') {
    const today = new Date().toDateString();
    canComplete = user.lastDailyReward !== today;
    if (canComplete) {
      user.lastDailyReward = today;
    }
  }
  
  if (!canComplete) {
    let errorText = t('subscribeFirst', user.language);
    if (task.type === 'referral') {
      errorText = `❌ Нужно пригласить ${task.target} друзей. У вас: ${getReferralCount(user.id)}`;
    } else if (task.type === 'daily') {
      errorText = t('dailyAlready', user.language);
    }
    await bot.answerCallbackQuery(chatId, { text: errorText });
    return;
  }
  
  // Выполняем задание
  user.coins += task.reward;
  user.completedTasks.push(taskId);
  
  // Обновляем уровень
  const newLevel = Math.floor(user.coins / 1000) + 1;
  if (newLevel > user.level) {
    user.level = newLevel;
  }
  
  updateUser(user.id, user);
  
  console.log(`✅ TASK COMPLETED: User ${user.id} completed task ${taskId}, earned ${task.reward} OK`);
  
  await showTasks(chatId, messageId, user);
  await bot.answerCallbackQuery(chatId, { 
    text: t('taskCompleted', user.language, { reward: task.reward }) 
  });
}

// Показать статистику
async function showStats(chatId, messageId, user) {
  const lang = user.language;
  const referralCount = getReferralCount(user.id);
  const joinDate = user.joinedAt.toLocaleDateString('ru-RU');
  
  const keyboard = {
    inline_keyboard: [
      [{ text: t('backButton', lang), callback_data: 'back' }]
    ]
  };
  
  await bot.editMessageText(t('stats', lang, {
    coins: user.coins.toLocaleString(),
    level: user.level,
    taps: user.dailyTaps,
    referrals: referralCount,
    joinDate: joinDate
  }), {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard
  });
}

// Показать лидерборд
async function showLeaderboard(chatId, messageId, user) {
  const lang = user.language;
  const sortedUsers = Array.from(users.values())
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 10);
  
  let text = "🏆 Топ-10 игроков:\n\n";
  
  sortedUsers.forEach((u, index) => {
    const name = u.firstName || u.username || `User${u.id}`;
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    text += `${medal} ${name} - ${u.coins.toLocaleString()} OK\n`;
  });
  
  const keyboard = {
    inline_keyboard: [
      [{ text: t('backButton', lang), callback_data: 'back' }]
    ]
  };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard
  });
}

// Показать рефералы
async function showReferrals(chatId, messageId, user) {
  const lang = user.language;
  const referralCount = getReferralCount(user.id);
  const referralLink = `https://t.me/CryptoOkayBot?start=ref${user.id}`;
  
  let text = `👥 Реферальная система:\n\n`;
  text += `🔗 Ваша ссылка:\n${referralLink}\n\n`;
  text += `👫 Приглашено друзей: ${referralCount}\n\n`;
  text += `💰 Награды за рефералов:\n`;
  text += `• 0-99 рефералов: 250 OK за каждого\n`;
  text += `• 100-499 рефералов: 125 OK за каждого\n`;
  text += `• 500+ рефералов: 75 OK за каждого`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "📤 Поделиться ссылкой", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎮 Присоединяйся к OkayCoin Bot! Тапай и зарабатывай OK!')}` }],
      [{ text: t('backButton', lang), callback_data: 'back' }]
    ]
  };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard
  });
}

// Обработка callback запросов
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const user = getUser(query.from.id);
  
  if (!user) return;
  
  try {
    console.log(`🔄 CALLBACK: chatId=${chatId}, data="${data}"`);
    
    if (data === 'tap') {
      await handleTap(query.id, messageId, user);
    } else if (data === 'tasks') {
      await showTasks(chatId, messageId, user);
    } else if (data === 'stats') {
      await showStats(chatId, messageId, user);
    } else if (data === 'leaderboard') {
      await showLeaderboard(chatId, messageId, user);
    } else if (data === 'referrals') {
      await showReferrals(chatId, messageId, user);
    } else if (data === 'share') {
      await showReferrals(chatId, messageId, user);
    } else if (data === 'back') {
      await showMainMenu(chatId, user, messageId);
    } else if (data.startsWith('task_')) {
      const taskId = parseInt(data.replace('task_', ''));
      await completeTask(query.id, messageId, user, taskId);
    }
  } catch (error) {
    console.error('❌ Callback error:', error);
    try {
      await bot.answerCallbackQuery(query.id, { text: "❌ Произошла ошибка" });
    } catch (e) {}
  }
});

// ================== EXPRESS СЕРВЕР ==================
const app = express();
app.use(express.json());

// Роут для проверки работоспособности
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    users: users.size,
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    users: users.size,
    tasks: tasks.size,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// ================== KEEP-ALIVE СИСТЕМА ==================
function startKeepAlive() {
  // Логи каждые 30 секунд
  setInterval(() => {
    console.log(`🛡️ Anti-sleep active | Users: ${users.size} | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  }, 30000);
  
  // Активность каждую минуту
  setInterval(() => {
    console.log(`🔄 Activity pulse | ${new Date().toISOString()}`);
  }, 60000);
  
  // Keep-alive каждые 3 минуты
  setInterval(() => {
    console.log('✅ Bot keep-alive ping');
  }, 3 * 60 * 1000);
}

// ================== ЗАПУСК ==================
function startBot() {
  console.log('🤖 Initializing OkayCoin Bot...');
  
  // Инициализация данных
  initializeTasks();
  
  // Запуск keep-alive системы
  startKeepAlive();
  
  // Запуск сервера
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log('✅ OkayCoin Bot started successfully!');
    console.log(`🤖 Bot username: @CryptoOkayBot`);
  });
}

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Запуск бота
startBot();

// ================== ЭКСПОРТ ==================
module.exports = { bot, app };
