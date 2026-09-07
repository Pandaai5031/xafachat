import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://xafachat.onrender.com';

const socket = io(BACKEND_URL, { 
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 2000
});

export default function App() {
  // Foydalanuvchi va kirish holati (Ro'yxatdan o'tishsiz, faqat nik bilan)
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('xafa_user') || '');
  const [usernameInput, setUsernameInput] = useState('');
  
  // Chat state
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [onlineList, setOnlineList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Yozib olish holatlari
  const [audioRecording, setAudioRecording] = useState(false);
  const [circleVideoRecording, setCircleVideoRecording] = useState(false);

  // Dizayn mavzusi
  const [theme, setTheme] = useState(() => localStorage.getItem('xafa_theme') || 'purple');

  // Refs
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const chatEndRef = useRef(null);

  // Mobil qurilmalarda keyboard ochilganda ekran kattalashib ketishini (Zoom) oldini olish
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  }, []);

  // Serverni uyg'otib turish
  useEffect(() => {
    const pingServer = async () => {
      try {
        await fetch(BACKEND_URL);
      } catch (e) {
        console.log("Ping error:", e);
      }
    };
    pingServer();
    const interval = setInterval(pingServer, 40000);
    return () => clearInterval(interval);
  }, []);

  // Socket hodisalari
  useEffect(() => {
    if (currentUser) {
      socket.emit('userConnected', currentUser);
    }

    socket.on('initMessages', (msgs) => setChat(msgs || []));

    socket.on('message', (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    socket.on('messageEdited', ({ id, newContent }) => {
      setChat((prev) =>
        prev.map((m) => (String(m._id) === String(id) ? { ...m, content: newContent } : m))
      );
    });

    socket.on('messageDeleted', (id) => {
      setChat((prev) => prev.filter((m) => String(m._id) !== String(id)));
    });

    socket.on('onlineList', (users) => {
      setOnlineList(users || []);
    });

    return () => {
      socket.off('initMessages');
      socket.off('message');
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('onlineList');
    };
  }, [currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Faqat Nik bilan kirish
  const handleSimpleLogin = (e) => {
    e.preventDefault();
    const name = usernameInput.trim();
    if (!name) return;

    localStorage.setItem('xafa_user', name);
    setCurrentUser(name);
    socket.emit('userConnected', name);
  };

  const handleLogout = () => {
    localStorage.removeItem('xafa_user');
    setCurrentUser('');
  };

  // Matnli xabar yuborish
  const sendTextMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('sendMessage', { username: currentUser, type: 'text', content: message.trim() });
      setMessage('');
    }
  };

  // Rasm yoki Video yuborish
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

    if (!fileType) {
      alert('Faqat rasm yoki video tanlang!');
      return;
    }

    reader.onload = () => {
      socket.emit('sendMessage', { username: currentUser, type: fileType, content: reader.result });
    };
    reader.readAsDataURL(file);
  };

  // Ovozli xabar yozish (Audio Note)
  const startAudioRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      audioRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      audioRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('sendMessage', { username: currentUser, type: 'audio', content: reader.result });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      audioRecorderRef.current.start();
      setAudioRecording(true);
    } catch (err) {
      alert('Mikrofonga ruxsat berilmadi!');
    }
  };

  const stopAudioRecord = () => {
    if (audioRecorderRef.current && audioRecording) {
      audioRecorderRef.current.stop();
      setAudioRecording(false);
    }
  };

  // Yumaloq Video Yozish (Krujok)
  const startCircleVideoRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 300, height: 300, facingMode: "user" }, 
        audio: true 
      });
      
      setCircleVideoRecording(true);

      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 100);

      videoRecorderRef.current = new MediaRecorder(stream);
      videoChunksRef.current = [];

      videoRecorderRef.current.ondataavailable = (e) => videoChunksRef.current.push(e.data);
      videoRecorderRef.current.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('sendMessage', { username: currentUser, type: 'circleVideo', content: reader.result });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      videoRecorderRef.current.start();
    } catch (err) {
      alert('Kameraga va mikrofonga ruxsat berilmadi!');
      setCircleVideoRecording(false);
    }
  };

  const stopCircleVideoRecord = () => {
    if (videoRecorderRef.current && circleVideoRecording) {
      videoRecorderRef.current.stop();
      setCircleVideoRecording(false);
    }
  };

  // Tahrirlash
  const handleEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.content);
  };

  const saveEdit = (id) => {
    if (editText.trim() && id) {
      socket.emit('editMessage', { id, username: currentUser, newContent: editText });
      setEditingId(null);
      setEditText('');
    }
  };

  // Aniq Ishlaydigan O'chirish (Delete)
  const handleDelete = (id) => {
    if (!id) return;
    if (window.confirm("Rostdan ham ushbu xabarni o'chirmoqchimisiz?")) {
      socket.emit('deleteMessage', { id, username: currentUser });
    }
  };

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('xafa_theme', newTheme);
  };

  const themeStyles = {
    purple: { bg: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #6c5ce7, #8c7ae6)' },
    dark: { bg: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', headerBg: '#1e272e', bubbleMe: 'linear-gradient(135deg, #00b894, #00cec9)' },
    sunset: { bg: 'linear-gradient(135deg, #ff7e5f, #feb47b)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #ff7675, #d63031)' },
    emerald: { bg: 'linear-gradient(135deg, #11998e, #38ef7d)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #00b894, #55efc4)' }
  };

  const currentStyle = themeStyles[theme] || themeStyles.purple;

  // 1. Kirmagan bo'lsa - Shunchaki Nik bilan kirish oynasi
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: currentStyle.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={loginCardStyle}>
          <div style={{ fontSize: '54px', marginBottom: '10px' }}>💬</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: '800', color: '#2d3436' }}>XAFA Chat</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#636e72' }}>Chatga kirish uchun ismingizni kiriting:</p>

          <form onSubmit={handleSimpleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="text"
              placeholder="Ismingiz (masalan: Ali)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={textInputStyle}
              required
            />
            <button type="submit" style={btnPrimaryStyle}>
              Chatga kirish 🚀
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Chat Asosiy oynasi
  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: currentStyle.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={chatContainerStyle}>
        
        {/* Top Header */}
        <header style={{ ...headerStyle, background: currentStyle.headerBg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={avatarStyle}>{currentUser.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: theme === 'dark' ? '#fff' : '#2d3436' }}>
                {currentUser}
              </div>
              <div style={{ fontSize: '11px', color: '#00b894', fontWeight: '600' }}>
                ● Online ({onlineList.length} kishi)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={theme}
              onChange={(e) => changeTheme(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="purple">💜 Binafsha</option>
              <option value="dark">🌙 Qorong'i</option>
              <option value="sunset">🌅 Quyosh</option>
              <option value="emerald">🟢 Zumrad</option>
            </select>
            <button onClick={handleLogout} style={logoutBtnStyle} title="Chiqish">🚪</button>
          </div>
        </header>

        {/* Online Status Bar */}
        <div style={onlineStripStyle}>
          <span style={{ fontSize: '11px', color: '#636e72', marginRight: '6px' }}>Onlayn:</span>
          {onlineList.map((u) => (
            <span key={u} style={onlineBadgeStyle}>
              <span style={{ color: '#00b894', marginRight: '4px' }}>●</span>{u}
            </span>
          ))}
        </div>

        {/* Krujok Yozish Preview Modal */}
        {circleVideoRecording && (
          <div style={{ position: 'absolute', top: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'rgba(0,0,0,0.85)', padding: '12px', borderRadius: '50%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <video ref={videoPreviewRef} autoPlay muted style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ color: '#fff', fontSize: '11px', marginTop: '6px', fontWeight: 'bold' }}>🔴 Yozilmoqda...</div>
          </div>
        )}

        {/* Chat Messages */}
        <div style={{ ...messageAreaStyle, background: theme === 'dark' ? '#121212' : '#f8f9fa' }}>
          {chat.map((msg) => {
            const isMe = msg.username?.toLowerCase() === currentUser?.toLowerCase();
            const isUserOnline = onlineList.some(u => u.toLowerCase() === msg.username?.toLowerCase());

            return (
              <div key={msg._id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                <div style={{
                  ...msgBubbleStyle,
                  background: isMe ? currentStyle.bubbleMe : (theme === 'dark' ? '#1e272e' : '#ffffff'),
                  color: isMe ? '#ffffff' : (theme === 'dark' ? '#ffffff' : '#2d3436'),
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
                }}>

                  {/* Header inside Bubble */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isMe ? '#dfe6e9' : '#6c5ce7' }}>
                      {msg.username} <span style={{ fontSize: '9px', color: isUserOnline ? '#00b894' : '#b2bec3' }}>({isUserOnline ? 'online' : 'offline'})</span>
                    </span>

                    {/* Edit / Delete Buttons */}
                    {isMe && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {msg.type === 'text' && (
                          <button onClick={() => handleEdit(msg)} style={actionBtnStyle} title="Tahrirlash">✏️</button>
                        )}
                        <button onClick={() => handleDelete(msg._id)} style={actionBtnStyle} title="O'chirish">🗑️</button>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  {editingId === msg._id ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{ ...textInputStyle, padding: '6px 10px', fontSize: '14px', margin: 0, flex: 1 }}
                      />
                      <button onClick={() => saveEdit(msg._id)} style={{ ...btnPrimaryStyle, padding: '6px 12px', fontSize: '12px' }}>✓</button>
                    </div>
                  ) : (
                    <>
                      {msg.type === 'text' && <div style={{ wordBreak: 'break-word', fontSize: '15px', lineHeight: '1.4' }}>{msg.content}</div>}
                      {msg.type === 'image' && <img src={msg.content} alt="Rasm" style={mediaStyle} />}
                      {msg.type === 'video' && <video src={msg.content} controls style={mediaStyle} />}
                      {msg.type === 'audio' && <audio src={msg.content} controls style={{ maxWidth: '100%', height: '36px', marginTop: '4px' }} />}
                      {msg.type === 'circleVideo' && (
                        <div style={{ textAlign: 'center', padding: '4px 0' }}>
                          <video src={msg.content} controls autoPlay loop muted style={circleVideoStyle} />
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ fontSize: '9px', opacity: 0.75, textAlign: 'right', marginTop: '4px' }}>{msg.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar - Zoom xatosini yo'qotuvchi maxsus shrift o'lchami bilan */}
        <form onSubmit={sendTextMessage} style={{ ...inputBarStyle, background: theme === 'dark' ? '#1e272e' : '#ffffff' }}>
          
          <label style={iconBtnStyle} title="Rasm/Video">
            📁
            <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button
            type="button"
            onClick={circleVideoRecording ? stopCircleVideoRecord : startCircleVideoRecord}
            style={{ ...iconBtnStyle, background: circleVideoRecording ? '#ff7675' : '#f1f2f6', color: circleVideoRecording ? '#fff' : '#2d3436' }}
            title={circleVideoRecording ? "Yumaloq videoni yuborish" : "Yumaloq video (Кружок)"}
          >
            {circleVideoRecording ? '⏹️' : '📹'}
          </button>

          <button
            type="button"
            onClick={audioRecording ? stopAudioRecord : startAudioRecord}
            style={{ ...iconBtnStyle, background: audioRecording ? '#ff7675' : '#f1f2f6', color: audioRecording ? '#fff' : '#2d3436' }}
            title={audioRecording ? "Ovozni yuborish" : "Ovozli xabar"}
          >
            {audioRecording ? '⏹️' : '🎙️'}
          </button>

          <input
            type="text"
            placeholder="Xabar yozing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={chatInputStyle}
          />

          <button type="submit" style={sendBtnStyle}>🚀</button>
        </form>

      </div>
    </div>
  );
}

// Styllar (Mobil va Desktop uchun moslashtirilgan)
const loginCardStyle = { background: '#ffffff', padding: '36px 28px', borderRadius: '24px', width: '90%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', textAlign: 'center' };
const chatContainerStyle = { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '480px', height: '100vh', background: '#ffffff', boxShadow: '0 0 30px rgba(0,0,0,0.15)', position: 'relative' };
const headerStyle = { padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f2f6' };
const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' };
const onlineStripStyle = { padding: '6px 16px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', overflowX: 'auto', gap: '6px', whiteSpace: 'nowrap' };
const onlineBadgeStyle = { background: '#eef2f5', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', color: '#2d3436' };
const messageAreaStyle = { flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' };
const msgBubbleStyle = { padding: '10px 14px', maxWidth: '82%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' };
const mediaStyle = { maxWidth: '100%', borderRadius: '12px', marginTop: '6px', display: 'block' };
const circleVideoStyle = { width: '170px', height: '170px', borderRadius: '50%', objectFit: 'cover', marginTop: '4px', border: '3px solid #ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' };
const inputBarStyle = { padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #eee' };

// Mobil Zoom yo'qotish kaliti: font-size: 16px qilib belgilandi
const chatInputStyle = { flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid #dfe6e9', background: '#f1f2f6', outline: 'none', fontSize: '16px', margin: 0 };
const textInputStyle = { padding: '12px 16px', borderRadius: '16px', border: '1px solid #dfe6e9', background: '#f1f2f6', outline: 'none', fontSize: '16px' };

const btnPrimaryStyle = { padding: '14px', borderRadius: '16px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', fontWeight: '700', fontSize: '16px', cursor: 'pointer' };
const iconBtnStyle = { padding: '0', borderRadius: '50%', border: 'none', background: '#f1f2f6', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', flexShrink: 0 };
const sendBtnStyle = { padding: '0 16px', height: '40px', borderRadius: '20px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', cursor: 'pointer', fontSize: '18px', flexShrink: 0 };
const actionBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px' };
const logoutBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px' };