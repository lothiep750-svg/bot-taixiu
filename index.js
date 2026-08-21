const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const http = require('http');

// 1. HTTP Server để Render không bị lỗi Port
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.write('Bot Tài Xỉu Đặt Cược đang chạy!');
  res.end();
}).listen(PORT);

// 2. Khởi tạo Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Lưu trữ số dư người chơi (Lưu tạm trên RAM)
const userBalances = {};
const lastDaily = {};

// Ảnh / GIF minh họa mở bát và kết quả
const GIF_XOC_BAT = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1eHNrb3RreTJzMm96ejR3NDU5dzF2YjF5Y3BxeWZidnh4ZngwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKsjLu9KflWtrfq/giphy.gif';
const IMG_TAI = 'https://i.imgur.com/3M7Z49s.png'; 
const IMG_XIU = 'https://i.imgur.com/v8S7p3R.png';

client.once('ready', () => {
  console.log(`✅ Bot Tài Xỉu Cược đã sẵn sàng: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const content = message.content.toLowerCase().trim();

  // Tạo tài khoản mặc định nếu chưa có (Tặng 10,000 Xu khởi nghiệp)
  if (!userBalances[userId]) {
    userBalances[userId] = 10000;
  }

  // LỆNH 1: Nhận tiền hàng ngày (!daily / !nhantien)
  if (content === '.diemdanh' || content === '.nhantien') {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 giờ

    if (lastDaily[userId] && (now - lastDaily[userId] < cooldown)) {
      const remaining = Math.ceil((cooldown - (now - lastDaily[userId])) / (1000 * 60 * 60));
      return message.reply(`⏳ Bạn đã nhận tiền hôm nay rồi! Vui lòng quay lại sau **${remaining} giờ**.`);
    }

    const thuong = 10000000000; // Tặng 50k xu
    userBalances[userId] += thuong;
    lastDaily[userId] = now;

    return message.reply(`💵 Bạn vừa nhận thành công **${thuong.toLocaleString()} Xu** điểm danh hàng ngày! Số dư hiện tại: **${userBalances[userId].toLocaleString()} Xu**.`);
  }

  // LỆNH 2: Xem số dư (!vi / !money / !sodu)
  if (content === '.vi' || content === '.money' || content === '.sodu') {
    return message.reply(`💰 Số dư ví của **${message.author.username}**: **${userBalances[userId].toLocaleString()} Xu**.`);
  }

  // LỆNH 3: Đặt cược Tài Xỉu (!tx tai <số_tiền> hoặc !tx xiu <số_tiền>)
  if (content.startsWith('.tx') || content.startsWith('.tx')) {
    const args = content.split(/\s+/);
    const luaChon = args[1];
    let tienCuoc = args[2];

    if (!luaChon || !['tai', 'xiu', 'tài', 'xỉu'].includes(luaChon)) {
      return message.reply('⚠️ Cú pháp: `!tx <tai/xiu> <số tiền>`\nVí dụ: `.tx tai 5000` hoặc `.tx xiu all`');
    }

    // Xử lý cược 'all' (Tố tất tay)
    if (tienCuoc === 'all') {
      tienCuoc = userBalances[userId];
    } else {
      tienCuoc = parseInt(tienCuoc);
    }

    if (isNaN(tienCuoc) || tienCuoc <= 0) {
      return message.reply('⚠️ Số tiền cược không hợp lệ!');
    }

    if (tienCuoc > userBalances[userId]) {
      return message.reply(`❌ Bạn không đủ tiền! Số dư hiện tại: **${userBalances[userId].toLocaleString()} Xu**.`);
    }

    // Trừ tiền cược trước khi lắc
    userBalances[userId] -= tienCuoc;

    // Gửi GIF lắc xóc bát
    const loadingMsg = await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎲 Đang xóc đĩa mở bát... 🎲')
          .setDescription(`Người chơi **${message.author.username}** đã đặt **${tienCuoc.toLocaleString()} Xu** vào **${luaChon.toUpperCase()}**!`)
          .setImage(GIF_XOC_BAT)
          .setColor('#FFFF00')
      ]
    });

    // Chờ 3 giây giả lập hiệu ứng mở bát
    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      const tong = d1 + d2 + d3;
      const ketQua = tong >= 11 ? 'TÀI' : 'XỈU';

      const chonTai = ['tai', 'tài'].includes(luaChon);
      const chonXiu = ['xiu', 'xỉu'].includes(luaChon);
      const thang = (chonTai && ketQua === 'TÀI') || (chonXiu && ketQua === 'XỈU');

      if (thang) {
        userBalances[userId] += tienCuoc * 2; // Thắng nhận x2
      }

      const diceEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🎲 KẾT QUẢ: ${ketQua} (${tong} ĐIỂM) 🎲`)
        .setDescription(
          `• Xí ngầu: ${diceEmojis[d1 - 1]} ${diceEmojis[d2 - 1]} ${diceEmojis[d3 - 1]}\n` +
          `• Cược: **${luaChon.toUpperCase()}** - **${tienCuoc.toLocaleString()} Xu**\n\n` +
          (thang 
            ? `🎉 **BẠN THẮNG!** Nhận **+${(tienCuoc * 2).toLocaleString()} Xu**` 
            : `❌ **BẠN THUA!** Mất **-${tienCuoc.toLocaleString()} Xu**`) +
          `\n💰 Số dư còn lại: **${userBalances[userId].toLocaleString()} Xu**`
        )
        .setColor(thang ? '#00FF00' : '#FF0000')
        .setThumbnail(ketQua === 'TÀI' ? IMG_TAI : IMG_XIU);

      loadingMsg.edit({ embeds: [resultEmbed] });
    }, 3000);
  }
});

client.login(process.env.BOT_TOKEN);
