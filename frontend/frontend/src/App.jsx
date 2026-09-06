import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('https://xafachat.onrender.com', {
  transports: ['websocket', 'polling']
});

export default function App() {
  const [auth, setAuth] = useState(false);
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [recording, setRecording] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on('initMessages', (msgs) => setChat(msgs));
    
    socket.on('message', (data) => {
      setChat((prev) => [...prev, data]);
    });

    socket.on('messageEdited', ({ id, newContent }) => {
      setChat((prev) => prev.map((msg) => msg._id === id ? { ...msg, content: newContent } : msg));
    });

    socket.on('messageDeleted', (id) => {
      setChat((prev) => prev.filter((msg) => msg._id !== id));
    });

    return () => {
      socket.off('initMessages');
      socket.off('message');
      socket.off('messageEdited');
      socket.off('messageDeleted');
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (code === 'Sumayyaxon2024' && username.trim()) setAuth(true);
    else alert("Maxfiy kod noto'g'ri!");
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('sendMessage', { username, type: 'text', content: message });
      setMessage('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;

    if (!fileType) {
      alert('Faqat rasm yoki video yuklashingiz mumkin!');
      return;
    }

    reader.onload = () => {
      socket.emit('sendMessage', { username, type: fileType, content: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('sendMessage', { username, type: 'audio', content: reader.result });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      alert('Mikrofon ishlamadi!');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.content);
  };

  const saveEdit = (id) => {
    if (editText.trim() && id) {
      socket.emit('editMessage', { id, newContent: editText });
      setEditingId(null);
      setEditText('');
    }
  };

  const handleDelete = (id) => {
    if (id && window.confirm("Xabarni o'chirmoqchimisiz?")) {
      socket.emit('deleteMessage', id);
    }
  };

  if (!auth) {
    return (
      <div style={pageBgStyle}>
        <form onSubmit={handleLogin} style={glassCardStyle}>
          <div style={logoBadgeStyle}>✨</div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800', background: 'linear-gradient(45deg, #ff7675, #6c5ce7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>XAFA Chat</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#636e72' }}>Maxfiy va estetik muloqot xonasi</p>
          
          <input
            type="text"
            placeholder="Nik / Ismingiz"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Maxfiy kod"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={primaryBtnStyle}>Kirish</button>
        </form>
      </div>
    );
  }

  return (
    <div style={pageBgStyle}>
      <div style={chatContainerStyle}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={avatarStyle}>{username.charAt(0).toUpperCase()}</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#2d3436' }}>XAFA Chat Room</h3>
              <span style={{ fontSize: '12px', color: '#00b894', fontWeight: '600' }}>● faol</span>
            </div>
          </div>
          <div style={userBadgeStyle}>{username}</div>
        </header>

        <div style={messageAreaStyle}>
          {chat.map((msg) => {
            const isMe = msg.username === username;
            return (
              <div key={msg._id} style={{ ...msgWrapperStyle, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...msgBubbleStyle, background: isMe ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : '#ffffff', color: isMe ? '#fff' : '#2d3436', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isMe ? '#dfe6e9' : '#6c5ce7' }}>{msg.username}</span>
                    
                    {isMe && msg._id && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {msg.type === 'text' && (
                          <button onClick={() => handleEdit(msg)} style={actionBtnStyle}>✏️</button>
                        )}
                        <button onClick={() => handleDelete(msg._id)} style={actionBtnStyle}>🗑️</button>
                      </div>
                    )}
                  </div>

                  {editingId === msg._id ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} style={{ ...inputStyle, padding: '6px', fontSize: '13px', margin: 0 }} />
                      <button onClick={() => saveEdit(msg._id)} style={{ ...primaryBtnStyle, padding: '6px 10px', fontSize: '12px' }}>✓</button>
                    </div>
                  ) : (
                    <>
                      {msg.type === 'text' && <div style={{ wordBreak: 'break-word', fontSize: '14px', lineHeight: '1.4' }}>{msg.content}</div>}
                      {msg.type === 'image' && <img src={msg.content} alt="Media" style={mediaStyle} />}
                      {msg.type === 'video' && <video src={msg.content} controls style={mediaStyle} />}
                      {msg.type === 'audio' && <audio src={msg.content} controls style={{ maxWidth: '100%', height: '36px' }} />}
                    </>
                  )}

                  <div style={{ fontSize: '10px', opacity: 0.7, textAlign: 'right', marginTop: '4px' }}>{msg.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} style={inputBarStyle}>
          <label style={iconBtnStyle} title="Fayl yuklash">
            📁
            <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <input
            type="text"
            placeholder="Xabar yozing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ ...inputStyle, flex: 1, margin: 0 }}
          />

          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            style={{ ...iconBtnStyle, background: recording ? '#ff7675' : '#f1f2f6' }}
            title={recording ? "To'xtatish" : "Ovozli xabar"}
          >
            {recording ? '🛑' : '🎙️'}
          </button>

          <button type="submit" style={sendBtnStyle}>🚀</button>
        </form>
      </div>
    </div>
  );
}

const pageBgStyle = { display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' };
const glassCardStyle = { background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', padding: '40px 32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', width: '90%', maxWidth: '350px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', textAlign: 'center' };
const logoBadgeStyle = { fontSize: '38px', marginBottom: '8px' };

const chatContainerStyle = { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '480px', height: '100vh', background: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(16px)', boxShadow: '0 0 30px rgba(0,0,0,0.1)' };
const headerStyle = { padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #f1f2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const avatarStyle = { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #ff7675, #6c5ce7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' };
const userBadgeStyle = { background: '#f1f2f6', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', color: '#2d3436' };

const messageAreaStyle = { flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8f9fa' };
const msgWrapperStyle = { display: 'flex', width: '100%' };
const msgBubbleStyle = { padding: '10px 14px', maxWidth: '78%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative' };
const mediaStyle = { maxWidth: '100%', borderRadius: '12px', marginTop: '6px', display: 'block' };

const inputBarStyle = { padding: '12px 16px', background: '#ffffff', borderTop: '1px solid #f1f2f6', display: 'flex', gap: '10px', alignItems: 'center' };
const inputStyle = { padding: '12px 16px', borderRadius: '24px', border: '1px solid #dfe6e9', background: '#f1f2f6', color: '#2d3436', outline: 'none', fontSize: '14px', marginBottom: '12px' };
const primaryBtnStyle = { padding: '12px', borderRadius: '24px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '15px' };
const iconBtnStyle = { padding: '10px 12px', borderRadius: '50%', background: '#f1f2f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', fontSize: '16px' };
const sendBtnStyle = { padding: '10px 16px', borderRadius: '24px', border: 'none', background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', color: '#fff', cursor: 'pointer', fontSize: '16px' };
const actionBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.8, padding: '2px' };