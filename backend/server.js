const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS sozlamalari
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Health-check endpoint (Render server uxlamay turishi uchun)
app.get('/', (req, res) => {
  res.send('XAFA Chat Backend is running live!');
});

// MongoDB Atlas ulanishi (Render Environment Variables dan oladi)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://madaliyevabror87_db_user:VhKvXdSKS3hxJsVF@cluster0.afuoudb.mongodb.net/xafaChatDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas-ga muvaffaqiyatli ulandi!'))
  .catch((err) => console.error('MongoDB ulanishda xatolik:', err));

// Xabarlar sxemasi
const MessageSchema = new mongoose.Schema({
  username: String,
  type: String, // text, image, video, audio
  content: String,
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);

const server = http.createServer(app);

// Socket.io sozlamalari
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // Buyuk hajmdagi fayllar (50MB+) uchun
});

io.on('connection', async (socket) => {
  console.log('Yangi foydalanuvchi ulandi:', socket.id);

  // Bazadan oxirgi 100 ta xabarni olish
  try {
    const history = await Message.find().sort({ createdAt: 1 }).limit(100);
    socket.emit('initMessages', history);
  } catch (err) {
    console.error('Xabarlarni yuklashda xatolik:', err);
  }

  // Yangi xabar kelganda bazaga saqlash va hammaning ekraniga tarqatish
  socket.on('sendMessage', async (data) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newMsg = new Message({
      username: data.username,
      type: data.type,
      content: data.content,
      time: timeStr
    });

    try {
      await newMsg.save();
      io.emit('message', newMsg);
    } catch (err) {
      console.error('Xabarni saqlashda xatolik:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Foydalanuvchi uzildi:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));