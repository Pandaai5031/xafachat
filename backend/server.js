const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));

app.get('/', (req, res) => {
  res.send('XAFA Chat Pro Backend Live!');
});

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://madaliyevabror87_db_user:VhKvXdSKS3hxJsVF@cluster0.afuoudb.mongodb.net/xafaChatDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas-ga ulandi!'))
  .catch((err) => console.error('MongoDB xatosi:', err));

// Schema-lar
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  avatarBg: { type: String, default: '#6c5ce7' },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  username: String,
  type: String, // 'text', 'image', 'video', 'audio', 'circleVideo'
  content: String,
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// Auth Marshrutlari
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Nik va parol kiritilishi shart!" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Bu nik band, boshqa nik tanlang yoki kiring!" });

    const colors = ['#6c5ce7', '#e84393', '#00b894', '#00cec9', '#fdcb6e', '#e17055'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const user = new User({ username, password, avatarBg: randomColor });
    await user.save();

    res.json({ success: true, username: user.username, avatarBg: user.avatarBg });
  } catch (err) {
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(400).json({ error: "Nik yoki parol noto'g'ri!" });

    res.json({ success: true, username: user.username, avatarBg: user.avatarBg });
  } catch (err) {
    res.status(500).json({ error: "Serverda xatolik" });
  }
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8
});

// Online foydalanuvchilarni kuzatish: { socketId: username }
const onlineUsers = new Map();

io.on('connection', async (socket) => {
  console.log('Socket ulandi:', socket.id);

  // Tarixni yuklash
  try {
    const history = await Message.find().sort({ createdAt: 1 }).limit(100);
    socket.emit('initMessages', history);
  } catch (err) {
    console.error('Tarix yuklashda xato:', err);
  }

  // Foydalanuvchi online bo'lganda
  socket.on('userConnected', (username) => {
    if (username) {
      onlineUsers.set(socket.id, username);
      const activeList = Array.from(new Set(onlineUsers.values()));
      io.emit('onlineList', activeList);
    }
  });

  // Yangi xabar
  socket.on('sendMessage', async (data) => {
    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newMsg = new Message({
        username: data.username,
        type: data.type,
        content: data.content,
        time: timeStr
      });

      const savedMsg = await newMsg.save();
      io.emit('message', savedMsg);
    } catch (err) {
      console.error('Xabar saqlash xatosi:', err);
    }
  });

  // Xabarni tahrirlash (Edit)
  socket.on('editMessage', async ({ id, username, newContent }) => {
    try {
      const msg = await Message.findById(id);
      if (msg && msg.username === username) {
        msg.content = newContent;
        await msg.save();
        io.emit('messageEdited', { id: msg._id.toString(), newContent: msg.content });
      }
    } catch (err) {
      console.error('Tahrirlash xatosi:', err);
    }
  });

  // Xabarni o'chirish (Delete)
  socket.on('deleteMessage', async ({ id, username }) => {
    try {
      const msg = await Message.findById(id);
      if (msg && msg.username === username) {
        await Message.findByIdAndDelete(id);
        io.emit('messageDeleted', id.toString());
      }
    } catch (err) {
      console.error('Ochirish xatosi:', err);
    }
  });

  // Foydalanuvchi tarmoqdan uzilganda
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    const activeList = Array.from(new Set(onlineUsers.values()));
    io.emit('onlineList', activeList);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));