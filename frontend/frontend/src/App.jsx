import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://xafachat.onrender.com';
const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('xafa_user') || null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Chat state
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [onlineList, setOnlineList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Recording state
  const [audioRecording, setAudioRecording] = useState(false);
  const [circleVideoRecording, setCircleVideoRecording] = useState(false);
  const [videoStream, setVideoStream] = useState(null);

  // Design Theme Customization
  const [theme, setTheme] = useState(() => localStorage.getItem('xafa_theme') || 'purple');

  // Refs
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      socket.emit('userConnected', currentUser);
    }

    socket.on('initMessages', (msgs) => setChat(msgs));

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
      setOnlineList(users);
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

  // Auth funksiyalari
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(BACKEND_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.trim(), password: passwordInput })
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Xatolik yuz berdi');
        return;
      }

      localStorage.setItem('xafa_user', data.username);
      setCurrentUser(data.username);
      socket.emit('userConnected', data.username);
    } catch (err) {
      setAuthError("Server bilan ulanishda xatolik!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('xafa_user');
    setCurrentUser(null);
  };

  // Xabar yuborish
  const sendTextMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('sendMessage', { username: currentUser, type: 'text', content: message });
      setMessage('');
    }
  };

  // Fayl (Rasm / Video) yuborish
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

    if (!fileType) {
      alert('Faqat rasm yoki video biriktirishingiz mumkin!');
      return;
    }

    reader.onload = () => {
      socket.emit('sendMessage', { username: currentUser, type: fileType, content: reader.result });
    };
    reader.readAsDataURL(file);
  };

  // Audio yozib olish (Ovozli xabar)
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300 }, audio: true });
      setVideoStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

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
        setVideoStream(null);
      };

      videoRecorderRef.current.start();
      setCircleVideoRecording(true);
    } catch (err) {
      alert('Kameraga ruxsat berilmadi!');
    }
  };

  const stopCircleVideoRecord = () => {
    if (videoRecorderRef.current && circleVideoRecording) {
      videoRecorderRef.current.stop();
      setCircleVideoRecording(false);
    }
  };

  // Tahrirlash (Edit)
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

  // O'chirish (Delete)
  const handleDelete = (id) => {
    if (id && window.confirm("Xabarni o'chirib tashlamoqchimisiz?")) {
      socket.emit('deleteMessage', { id, username: currentUser });
    }
  };

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('xafa_theme', newTheme);
  };

  // Theme Styllari
  const themeStyles = {
    purple: { bg: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #6c5ce7, #8c7ae6)' },
    dark: { bg: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', headerBg: '#1e272e', bubbleMe: 'linear-gradient(135deg, #00b894, #00cec9)' },
    sunset: { bg: 'linear-gradient(135deg, #ff7e5f, #feb47b)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #ff7675, #d63031)' },
    emerald: { bg: 'linear-gradient(135deg, #11998e, #38ef7d)', headerBg: '#ffffff', bubbleMe: 'linear-gradient(135deg, #00b894, #55efc4)' }
  };

  const currentStyle = themeStyles[theme] || themeStyles.purple;

  // Agar tizimga kirmagan bo'lsa (Login / Register Card)
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: currentStyle.bg }}>
        <div style={authCardStyle}>
          <div style={{ fontSize: '42px', marginBottom: '8px' }}>💬</div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800', color: '#2d3436' }}>XAFA Chat</h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#636e72' }}>
            {isLoginMode ? 'Oʻz profilingizga kiring' : 'Yangi profil roʻyxatdan oʻtkazing'}
          </p>

          {authError && <div style={errorStyle}>{authError}</div>}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Nik (Username)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={inputStyle}
              required
            />
            <input
              type="password"
              placeholder="Parol"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={inputStyle}
              required
            />
            <button type="submit" style={btnPrimaryStyle}>
              {isLoginMode ? 'Kirish' : 'Roʻyxatdan oʻtish'}
            </button>
          </form>

          <button
            onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
            style={{ background: 'none', border: 'none', color: '#6c5ce7', marginTop: '16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
          >
            {isLoginMode ? "Akkauntingiz yo'qmi? Ro'yxatdan o'ting" : "Akkauntingiz bormi? Kirish"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: currentStyle.bg }}>
      <div style={chatContainerStyle}>
        
        {/* Header */}
        <header style={{ ...headerStyle, background: currentStyle.headerBg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={avatarStyle}>{currentUser.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: theme === 'dark' ? '#fff' : '#2d3436' }}>
                {currentUser}
              </div>
              <div style={{ fontSize: '11px', color: '#00b894', fontWeight: '600' }}>
                ● Online ({onlineList.length} faol)
              </div>
            </div>
          </div>

          {/* Theme Selector va Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={theme}
              onChange={(e) => changeTheme(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '12px', border: '1px solid #ccc', fontSize: '12px', outline: 'none' }}
            >
              <option value="purple">💜 Binafsha</option>
              <option value="dark">🌙 Qorong'i</option>
              <option value="sunset">🌅 Qosh qorayishi</option>
              <option value="emerald">🟢 Zumrad</option>
            </select>
            <button onClick={handleLogout} style={logoutBtnStyle} title="Chiqish">🚪</button>
          </div>
        </header>

        {/* Online User Strip */}
        <div style={onlineStripStyle}>
          <span style={{ fontSize: '11px', color: '#636e72', marginRight: '6px' }}>Hozir faol:</span>
          {onlineList.map((u) => (
            <span key={u} style={onlineBadgeStyle}>
              <span style={{ color: '#00b894', marginRight: '3px' }}>●</span>{u}
            </span>
          ))}
        </div>

        {/* Video Preview Modal (Krujok yozilayotganda) */}
        {circleVideoRecording && (
          <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '50%' }}>
            <video ref={videoPreviewRef} autoPlay muted style={{ width: '140px', height: '140px', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Messages Body */}
        <div style={{ ...messageAreaStyle, background: theme === 'dark' ? '#121212' : '#f8f9fa' }}>
          {chat.map((msg) => {
            const isMe = msg.username === currentUser;
            const isUserOnline = onlineList.includes(msg.username);

            return (
              <div key={msg._id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                <div style={{
                  ...msgBubbleStyle,
                  background: isMe ? currentStyle.bubbleMe : (theme === 'dark' ? '#1e272e' : '#ffffff'),
                  color: isMe ? '#ffffff' : (theme === 'dark' ? '#ffffff' : '#2d3436'),
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
                }}>

                  {/* Header inside Bubble */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isMe ? '#dfe6e9' : '#6c5ce7' }}>
                      {msg.username} <span style={{ fontSize: '9px', color: isUserOnline ? '#00b894' : '#b2bec3' }}>({isUserOnline ? 'online' : 'offline'})</span>
                    </span>

                    {/* Edit and Delete Buttons (Faqat o'zining xabarida ko'rinadi) */}
                    {isMe && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {msg.type === 'text' && (
                          <button onClick={() => handleEdit(msg)} style={actionBtnStyle} title="Tahrirlash">✏️</button>
                        )}
                        <button onClick={() => handleDelete(msg._id)} style={actionBtnStyle} title="O'chirish">🗑️</button>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  {editingId === msg._id ? (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{ ...inputStyle, padding: '4px 8px', fontSize: '13px', margin: 0 }}
                      />
                      <button onClick={() => saveEdit(msg._id)} style={{ ...btnPrimaryStyle, padding: '4px 8px', fontSize: '12px' }}>✓</button>
                    </div>
                  ) : (
                    <>
                      {msg.type === 'text' && <div style={{ wordBreak: 'break-word', fontSize: '14px' }}>{msg.content}</div>}
                      {msg.type === 'image' && <img src={msg.content} alt="Rasm" style={mediaStyle} />}
                      {msg.type === 'video' && <video src={msg.content} controls style={mediaStyle} />}
                      {msg.type === 'audio' && <audio src={msg.content} controls style={{ maxWidth: '100%', height: '36px' }} />}
                      {msg.type === 'circleVideo' && (
                        <video src={msg.content} controls autoPlay loop muted style={circleVideoStyle} />
                      )}
                    </>
                  )}

                  <div style={{ fontSize: '9px', opacity: 0.7, textAlign: 'right', marginTop: '4px' }}>{msg.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Controls Bar */}
        <form onSubmit={sendTextMessage} style={{ ...inputBarStyle, background: theme === 'dark' ? '#1e272e' : '#ffffff' }}>
          
          {/* File Upload Button */}
          <label style={iconBtnStyle} title="Rasm/Video biriktirish">
            📁
            <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {/* Krujok Video Record Button */}
          <button
            type="button"
            onClick={circleVideoRecording ? stopCircleVideoRecord : startCircleVideoRecord}
            style={{ ...iconBtnStyle, background: circleVideoRecording ? '#ff7675' : '#f1f2f6' }}
            title={circleVideoRecording ? "Yumaloq videoni yuborish" : "Yumaloq video (Кружок)"}
          >
            {circleVideoRecording ? '⏹️' : '📹'}
          </button>

          {/* Audio Record Button */}
          <button
            type="button"
            onClick={audioRecording ? stopAudioRecord : startAudioRecord}
            style={{ ...iconBtnStyle, background: audioRecording ? '#ff7675' : '#f1f2f6' }}
            title={audioRecording ? "Ovozni yuborish" : "Ovozli xabar"}
          >
            {audioRecording ? '⏹️' : '🎙️'}
          </button>

          {/* Text input */}
          <input
            type="text"
            placeholder="Xabar yozing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ ...inputStyle, flex: 1, margin: 0 }}
          />

          {/* Send text button */}
          <button type="submit" style={sendBtnStyle}>🚀</button>
        </form>

      </div>
    </div>
  );
}

// Styling Object-lar
const authCardStyle = { background: '#ffffff', padding: '36px 28px', borderRadius: '24px', width: '90%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', textAlign: 'center' };
const chatContainerStyle = { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '480px', height: '100vh', background: '#ffffff', boxShadow: '0 0 30px rgba(0,0,0,0.2)', position: 'relative' };
const headerStyle = { padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f2f6' };
const avatarStyle = { width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' };
const onlineStripStyle = { padding: '6px 16px', background: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', overflowX: 'auto', gap: '6px', whiteSpace: 'nowrap' };
const onlineBadgeStyle = { background: '#eef2f5', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', color: '#2d3436' };
const messageAreaStyle = { flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' };
const msgBubbleStyle = { padding: '8px 12px', maxWidth: '80%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const mediaStyle = { maxWidth: '100%', borderRadius: '10px', marginTop: '4px', display: 'block' };
const circleVideoStyle = { width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', marginTop: '6px', border: '3px solid #ffffff' };
const inputBarStyle = { padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #eee' };
const inputStyle = { padding: '10px 14px', borderRadius: '20px', border: '1px solid #dfe6e9', background: '#f1f2f6', outline: 'none', fontSize: '14px' };
const btnPrimaryStyle = { padding: '12px', borderRadius: '20px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', fontWeight: '700', cursor: 'pointer' };
const iconBtnStyle = { padding: '8px', borderRadius: '50%', border: 'none', background: '#f1f2f6', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' };
const sendBtnStyle = { padding: '8px 14px', borderRadius: '20px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', cursor: 'pointer', fontSize: '16px' };
const actionBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.8, padding: '2px' };
const logoutBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' };
const errorStyle = { background: '#ffeaa7', color: '#d63031', padding: '8px', borderRadius: '12px', fontSize: '12px', marginBottom: '12px' };