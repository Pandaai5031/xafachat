const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// MongoDB Atlas ulanishi
const MONGO_URI = "mongodb+srv://madaliyevabror87_db_user:VhKvXdSKS3hxJsVF@cluster0.afuoudb.mongodb.net/xafaChatDB?retryWrites=true&w=majority";

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
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8
});

io.on('connection', async (socket) => {
  // Bazadan oxirgi 100 ta xabarni olish
  try {
    const history = await Message.find().sort({ createdAt: 1 }).limit(100);
    socket.emit('initMessages', history);
  } catch (err) {
    console.error('Xabarlarni yuklashda xatolik:', err);
  }

  // Yangi xabar kelganda bazaga saqlash va tarqatish
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
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));