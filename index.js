const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const http = require('http');

// 1. HTTP Server giữ bot 24/7 trên Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.write('Bot Tài Xỉu Auto Session + Soi Cầu Chart đang chạy 24/7!');
  res.end();
}).listen(PORT);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let ADMIN_ID = ''; 
const userBalances = {};
const giftCodes = {}; 
const cooldownSC = {}; // Quản lý Cooldown lệnh .sc
let jackpotPool = 100000; 

// MẢNG LƯU LỊCH SỬ KẾT QUẢ ĐỂ SOI CẦU (Lưu tối đa 20 phiên)
const gameHistory = []; 

const RANDOM_GIFS = [
  'https://i.makeagif.com/media/11-16-2015/34W3_c.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1eHNrb3RreTJzMm96ejR3NDU5dzF2YjF5Y3BxeWZidnh4ZngwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKsjLu9KflWtrfq/giphy.gif',
  'https://media.giphy.com/media/l41YkxvU8cChKmCBI/giphy.gif'
];

let currentSession = {
  id: 326000,
  timeLeft: 35,
  status: 'WAITING',
  bets: [],
  messageObj: null,
  timerInterval: null
};

client.once('ready', () => {
  console.log(`✅ Bot Tài Xỉu Soi Cầu Chart đã Online: ${client.user.tag}`);
});

function getBalance(userId) {
  if (!userBalances[userId]) userBalances[userId] = 10000;
  return userBalances[userId];
}

// ================= HÀM VẼ ẢNH SOI CẦU =================
async function drawSoiCauChart(history) {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');

  // Nền xám đen nhám chuẩn sòng bạc
  ctx.fillStyle = '#1e1f29';
  ctx.fillRect(0, 0, 800, 480);

  // Khung chứa biểu đồ
  ctx.fillStyle = '#2b2d3e';
  ctx.roundRect(15, 15, 770, 450, 12);
  ctx.fill();

  // Tiêu đề & Thông tin phiên
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('THỐNG KÊ PHIÊN', 310, 45);

  const last = history[history.length - 1];
  if (last) {
    ctx.fillStyle = '#a0a5ba';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Phiên gần nhất: #${last.sessionId} ${last.result} (${last.dice[0]}-${last.dice[1]}-${last.dice[2]})`, 500, 45);
  }

  // --- 1. BIỂU ĐỒ TRÊN: TỔNG ĐIỂM (3 - 18) ---
  const topY = 70, topH = 170;
  const startX = 60, width = 700;

  // Lưới ngang
  ctx.strokeStyle = '#3d405b';
  ctx.lineWidth = 1;
  const topScores = [18, 15, 12, 9, 6, 3];
  topScores.forEach(score => {
    const y = topY + topH - ((score - 3) / 15) * topH;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.stroke();

    ctx.fillStyle = '#8e94a8';
    ctx.font = '11px sans-serif';
    ctx.fillText(score.toString(), startX - 25, y + 4);
  });

  // Vẽ đường nối các điểm tổng
  if (history.length > 1) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((h, i) => {
      const stepX = history.length > 1 ? width / (history.length - 1) : 0;
      const x = startX + i * stepX;
      const y = topY + topH - ((h.score - 3) / 15) * topH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Vẽ các nút tròn số điểm trên đường nối
  history.forEach((h, i) => {
    const stepX = history.length > 1 ? width / (history.length - 1) : 0;
    const x = startX + i * stepX;
    const y = topY + topH - ((h.score - 3) / 15) * topH;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(h.score.toString(), x, y + 3.5);
  });

  // --- 2. BIỂU ĐỒ DƯỚI: 3 XÍ NGẦU (1 - 6) ---
  const botY = 270, botH = 160;
  ctx.textAlign = 'left';

  // Chú thích 3 con Xí ngầu
  const colors = ['#9966ff', '#4bc0c0', '#36a2eb']; // Tím, Xanh lá, Xanh dương
  ['Xí Ngầu 1', 'Xí Ngầu 2', 'Xí Ngầu 3'].forEach((name, idx) => {
    ctx.fillStyle = colors[idx];
    ctx.beginPath();
    ctx.arc(300 + idx * 100, 260, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a0a5ba';
    ctx.font = '11px sans-serif';
    ctx.fillText(name, 310 + idx * 100, 263);
  });

  // Lưới ngang xí ngầu 1-6
  for (let val = 1; val <= 6; val++) {
    const y = botY + botH - ((val - 1) / 5) * botH;
    ctx.strokeStyle = '#3d405b';
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.stroke();

    ctx.fillStyle = '#8e94a8';
    ctx.font = '11px sans-serif';
    ctx.fillText(val.toString(), startX - 25, y + 4);
  }

  // Vẽ 3 đường xí ngầu
  for (let diceIdx = 0; diceIdx < 3; diceIdx++) {
    if (history.length > 1) {
      ctx.strokeStyle = colors[diceIdx];
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.forEach((h, i) => {
        const stepX = history.length > 1 ? width / (history.length - 1) : 0;
        const x = startX + i * stepX;
        const diceVal = h.dice[diceIdx];
        const y = botY + botH - ((diceVal - 1) / 5) * botH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Nút điểm
    history.forEach((h, i) => {
      const stepX = history.length > 1 ? width / (history.length - 1) : 0;
      const x = startX + i * stepX;
      const diceVal = h.dice[diceIdx];
      const y = botY + botH - ((diceVal - 1) / 5) * botH;

      ctx.fillStyle = colors[diceIdx];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Footer Watermark
  ctx.fillStyle = '#6c728f';
  ctx.font = 'italic 11px sans-serif';
  ctx.fillText('Powered by Bot Tài Xỉu', 650, 460);

  return canvas.toBuffer('image/png');
}

// --- LỆNH ADMIN & LỆNH CHAT ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!ADMIN_ID) ADMIN_ID = message.author.id;

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args[0].toLowerCase();

  // LỆNH SOI CẦU .sc HOẶC !sc
  if (command === '.sc' || command === '.sc' || command === '.soicau' || command === '!soicau') {
    const userId = message.author.id;
    const now = Date.now();

    // Cooldown 8 giây mỗi lần gõ .sc
    if (cooldownSC[userId] && now - cooldownSC[userId] < 8000) {
      const remaining = ((8000 - (now - cooldownSC[userId])) / 1000).toFixed(1);
      return message.reply(`⏳ Chờ **${remaining}s** nữa.`);
    }

    if (gameHistory.length === 0) {
      return message.reply('📊 Chưa có dữ liệu lịch sử phiên để soi cầu!');
    }

    cooldownSC[userId] = now;

    // Tạo ảnh biểu đồ
    const imageBuffer = await drawSoiCauChart(gameHistory);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'soicau.png' });

    return message.reply({
      content: `📊 **Thống kê ${gameHistory.length} phiên gần nhất:**`,
      files: [attachment]
    });
  }

  // LỆNH SÒNG BẠC !tx / !menu
  if (command === '.tx' || command === '.menu') {
    startNewSession(message.channel);
    return;
  }

  // LỆNH CODE ADMIN
  if (command === '.taocode') {
    if (message.author.id !== ADMIN_ID) return message.reply('❌ Chỉ Admin mới có quyền!');
    const code = args[1]?.toUpperCase();
    const amount = parseInt(args[2]);
    const maxUses = parseInt(args[3]) || 1;

    if (!code || isNaN(amount) || amount <= 0) {
      return message.reply('⚠️ Cú pháp: `.taocode <MÃ> <SỐ_TIỀN> <LẦN_NHẬP>`');
    }

    giftCodes[code] = { amount, maxUses, usedBy: [] };
    return message.reply(`🎉 **Đã tạo Code:** **${code}** (+${amount.toLocaleString()} Xu, ${maxUses} lượt)`);
  }

  if (command === '.nhancode' || command === '.code') {
    const code = args[1]?.toUpperCase();
    if (!code || !giftCodes[code]) return message.reply('❌ Mã không tồn tại!');
    const gift = giftCodes[code];
    if (gift.usedBy.includes(message.author.id)) return message.reply('⚠️ Bạn đã nhận code này rồi!');
    if (gift.usedBy.length >= gift.maxUses) return message.reply('❌ Mã đã hết lượt!');

    gift.usedBy.push(message.author.id);
    userBalances[message.author.id] = getBalance(message.author.id) + gift.amount;
    return message.reply(`🎁 Nhận thành công **+${gift.amount.toLocaleString()} Xu**!`);
  }

  if (command === '.gift' || command === '.gift') {
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);

    if (!targetUser || isNaN(amount) || amount <= 0) return message.reply('⚠️ Cú pháp: `.gift @User <SỐ_TIỀN>`');
    if (message.author.id !== ADMIN_ID && getBalance(message.author.id) < amount) return message.reply('❌ Bạn không đủ tiền!');

    if (message.author.id !== ADMIN_ID) userBalances[message.author.id] -= amount;
    userBalances[targetUser.id] = getBalance(targetUser.id) + amount;
    return message.reply(`💸 **${message.author.username}** đã tặng **${amount.toLocaleString()} Xu** cho **${targetUser.username}**!`);
  }

  if (command === '.sodu' || command === '.sodu') {
    return message.reply(`💰 Số dư của **${message.author.username}**: **${getBalance(message.author.id).toLocaleString()} Xu**`);
  }
});

// --- PHIÊN ĐẾM NGƯỢC 35 GIÂY ---
async function startNewSession(channel) {
  if (currentSession.status === 'WAITING' && currentSession.messageObj) return;

  currentSession.id += 1;
  currentSession.timeLeft = 35;
  currentSession.status = 'WAITING';
  currentSession.bets = [];

  const embed = buildSessionEmbed();
  const components = buildButtons();

  const msg = await channel.send({ embeds: [embed], components });
  currentSession.messageObj = msg;

  currentSession.timerInterval = setInterval(async () => {
    currentSession.timeLeft -= 5;

    if (currentSession.timeLeft > 0) {
      await msg.edit({ embeds: [buildSessionEmbed()], components: buildButtons() }).catch(() => {});
    } else {
      clearInterval(currentSession.timerInterval);
      currentSession.status = 'CLOSED';
      await processSessionResult(channel, msg);
    }
  }, 5000);
}

async function processSessionResult(channel, msg) {
  const randomGif = RANDOM_GIFS[Math.floor(Math.random() * RANDOM_GIFS.length)];

  await msg.edit({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎲 PHIÊN #${currentSession.id} - ĐANG MỞ BÁT! 🎲`)
        .setDescription('🔥 Bát đang được xóc, chúc tất cả người chơi may mắn!')
        .setImage(randomGif)
        .setColor('#FFFF00')
    ],
    components: []
  });

  setTimeout(async () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const tong = d1 + d2 + d3;

    const isTai = tong >= 11;
    const isChan = tong % 2 === 0;
    const isBao = (d1 === d2 && d2 === d3);

    // Lưu vào lịch sử (Giữ lại tối đa 20 phiên)
    gameHistory.push({
      sessionId: currentSession.id,
      result: isTai ? 'TAI' : 'XIU',
      score: tong,
      dice: [d1, d2, d3]
    });

    if (gameHistory.length > 20) gameHistory.shift();

    let sessionSummary = `🎲 Kết quả: **${d1} - ${d2} - ${d3}** ➔ **${tong} Điểm** (${isTai ? 'TÀI 🔴' : 'XỈU 🔵'} - ${isChan ? 'CHẮN' : 'LẺ'})\n`;
    if (isBao) sessionSummary += `💥💥 **NỔ HŨ BẢO (${d1}-${d2}-${d3})! HŨ CÓ: ${jackpotPool.toLocaleString()} XU** 💥💥\n`;

    let totalTaxToAdmin = 0;
    let winnersList = [];

    currentSession.bets.forEach(bet => {
      let isWin = false;
      let winMultiplier = 0;

      if (bet.type === 'TAI' && isTai) { isWin = true; winMultiplier = 2; }
      if (bet.type === 'XIU' && !isTai) { isWin = true; winMultiplier = 2; }
      if (bet.type === 'CHAN' && isChan) { isWin = true; winMultiplier = 2; }
      if (bet.type === 'LE' && !isChan) { isWin = true; winMultiplier = 2; }

      if (isWin) {
        let winAmount = bet.amount * winMultiplier;
        if (isBao) {
          const jackpotBonus = Math.floor(jackpotPool / 2);
          winAmount += jackpotBonus;
          jackpotPool -= jackpotBonus;
        }
        userBalances[bet.userId] = getBalance(bet.userId) + winAmount;
        winnersList.push(`• **${bet.username}**: +${winAmount.toLocaleString()} Xu`);
      } else {
        totalTaxToAdmin += bet.amount;
      }
    });

    if (ADMIN_ID && totalTaxToAdmin > 0) userBalances[ADMIN_ID] = getBalance(ADMIN_ID) + totalTaxToAdmin;

    const resultEmbed = new EmbedBuilder()
      .setTitle(`🎰 PHIÊN #${currentSession.id} - KẾT QUẢ 🎰`)
      .setDescription(
        `${sessionSummary}\n` +
        `🏆 **NGƯỜI THẮNG PHIÊN NÀY:**\n` +
        (winnersList.length > 0 ? winnersList.join('\n') : 'Không có ai thắng phiên này!') +
        `\n\n💰 **Hũ Jackpot:** **${jackpotPool.toLocaleString()} Xu**`
      )
      .setColor(isTai ? '#FF0000' : '#0000FF');

    await msg.edit({ embeds: [resultEmbed], components: [] });

    setTimeout(() => {
      startNewSession(channel);
    }, 10000);

  }, 3500);
}

function buildSessionEmbed() {
  let totalBetPool = 0;
  let betDetails = currentSession.bets.map(b => {
    totalBetPool += b.amount;
    return `• **${b.username}**: ${b.type} - ${b.amount.toLocaleString()} Xu`;
  }).join('\n');

  let soiCauString = gameHistory.map(h => h.result === 'TAI' ? '🔴' : '🔵').join(' ➔ ');

  return new EmbedBuilder()
    .setTitle(`🎰 PHIÊN TÀI XỈU #${currentSession.id} 🎰`)
    .setDescription(
      `⏳ Thời gian còn lại: **${currentSession.timeLeft} Giây**\n` +
      `🏆 **Hũ Jackpot:** **${jackpotPool.toLocaleString()} Xu**\n\n` +
      `📈 **SOI CẦU CHUỖI:** ${soiCauString || '*Chưa có phiên*'}\n` +
      `💡 *Gõ \`.sc\` để xem Biểu Đồ Thống Kê hình ảnh!*\n\n` +
      `📊 **DANH SÁCH ĐẶT CƯỢC:**\n` +
      (betDetails || '*Chưa có ai đặt cược*')
    )
    .setColor('#00FF00');
}

function buildButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bet_TAI').setLabel('🔴 TÀI (x2)').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bet_XIU').setLabel('⚫ XỈU (x2)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bet_CHAN').setLabel('🔵 CHẮN (x2)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bet_LE').setLabel('🟡 LẺ (x2)').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_SOICAU').setLabel('📊 Biểu Đồ Soi Cầu').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_VI').setLabel('💰 Xem Ví').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_CODE').setLabel('🎁 Mã Code').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const balance = getBalance(userId);

  // Nút bấm Soi Cầu cũng sẽ vẽ ảnh biểu đồ gửi cho người bấm
  if (interaction.customId === 'btn_SOICAU') {
    if (gameHistory.length === 0) {
      return interaction.reply({ content: '📊 Chưa có đủ dữ liệu lịch sử phiên!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const imageBuffer = await drawSoiCauChart(gameHistory);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'soicau.png' });

    return interaction.editReply({
      content: `📊 **Thống kê ${gameHistory.length} phiên gần nhất:**`,
      files: [attachment]
    });
  }

  if (interaction.customId === 'btn_VI') {
    return interaction.reply({ content: `💰 Số dư ví của bạn: **${balance.toLocaleString()} Xu**`, ephemeral: true });
  }

  if (interaction.customId === 'btn_CODE') {
    return interaction.reply({ content: `🎁 Nhập \`!nhancode <MÃ_CODE>\` ngoài chat để nhận xu!`, ephemeral: true });
  }

  if (currentSession.status !== 'WAITING') {
    return interaction.reply({ content: '❌ Phiên cược đã đóng để mở bát!', ephemeral: true });
  }

  const customId = interaction.customId;
  if (['bet_TAI', 'bet_XIU', 'bet_CHAN', 'bet_LE'].includes(customId)) {
    const betType = customId.replace('bet_', '');
    const amount = 5000;

    if (balance < amount) return interaction.reply({ content: `❌ Bạn không đủ tiền! Cần **${amount.toLocaleString()} Xu**.`, ephemeral: true });

    userBalances[userId] -= amount;
    jackpotPool += Math.floor(amount * 0.05);

    currentSession.bets.push({
      userId,
      username: interaction.user.username,
      type: betType,
      amount
    });

    await interaction.reply({ content: `✅ Đã cược **${amount.toLocaleString()} Xu** vào **${betType}**!`, ephemeral: true });
    await currentSession.messageObj.edit({ embeds: [buildSessionEmbed()], components: buildButtons() }).catch(() => {});
  }
});

client.login(process.env.BOT_TOKEN);
