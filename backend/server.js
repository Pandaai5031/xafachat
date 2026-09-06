const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('XAFA Chat Backend Live!');
});

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://madaliyevabror87_db_user:VhKvXdSKS3hxJsVF@cluster0.afuoudb.mongodb.net/xafaChatDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas OK'))
  .catch((err) => console.error('MongoDB Error:', err));

const MessageSchema = new mongoose.Schema({
  username: String,
  type: String,
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
  console.log('Yangi foydalanuvchi ulandi:', socket.id);

  try {
    const history = await Message.find().sort({ createdAt: 1 }).limit(100);
    socket.emit('initMessages', history);
  } catch (err) {
    console.error('Fetch error:', err);
  }

  // Yangi xabar saqlash
  socket.on('sendMessage', async (data) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = new Message({
      username: data.username,
      type: data.type,
      content: data.content,
      time: timeStr
    });

    try {
      const savedMsg = await newMsg.save();
      io.emit('message', savedMsg);
    } catch (err) {
      console.error('Save error:', err);
    }
  });

  // Tahrirlash
  socket.on('editMessage', async (payload) => {
    console.log('Edit keldi:', payload);
    const { id, newContent } = payload || {};
    if (!id || !newContent) return;

    try {
      const updated = await Message.findByIdAndUpdate(id, { content: newContent }, { new: true });
      if (updated) {
        io.emit('messageEdited', { id: updated._id.toString(), newContent: updated.content });
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  });

  // O'chirish
  socket.on('deleteMessage', async (id) => {
    console.log('Delete keldi ID:', id);
    if (!id) return;

    try {
      await Message.findByIdAndDelete(id);
      io.emit('messageDeleted', id.toString());
    } catch (err) {
      console.error('Delete error:', err);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));