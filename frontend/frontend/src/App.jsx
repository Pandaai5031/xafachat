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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on('initMessages', (msgs) => setChat(msgs));
    socket.on('message', (data) => {
      setChat((prev) => [...prev, data]);
    });
    return () => {
      socket.off('initMessages');
      socket.off('message');
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (code === '1234' && username.trim()) setAuth(true);
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

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

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
      alert('Mikrofon ishlamadi yoki ruxsat berilmadi!');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (!auth) {
    return (
      <div style={loginContainerStyle}>
        <form onSubmit={handleLogin} style={loginCardStyle}>
          <div style={logoBadgeStyle}>💬</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700' }}>XAFA Chat</h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#94a3b8' }}>Xavfsiz va tezkor muloqot</p>
          
          <input
            type="text"
            placeholder="Nik / Ismingiz"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Maxfiy kod (1234)"
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
    <div style={chatContainerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={avatarStyle}>{username.charAt(0).toUpperCase()}</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>XAFA Chat Room</h3>
            <span style={{ fontSize: '12px', color: '#22c55e' }}>● onlayn</span>
          </div>
        </div>
        <div style={userBadgeStyle}>{username}</div>
      </header>

      {/* Message Feed */}
      <div style={messageAreaStyle}>
        {chat.map((msg, index) => {
          const isMe = msg.username === username;
          return (
            <div key={msg.id || index} style={{ ...msgWrapperStyle, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...msgBubbleStyle, background: isMe ? '#2563eb' : '#1e293b', borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px' }}>
                {!isMe && <div style={senderNameStyle}>{msg.username}</div>}
                
                {msg.type === 'text' && <div style={{ wordBreak: 'break-word', fontSize: '14px', lineHeight: '1.4' }}>{msg.content}</div>}
                {msg.type === 'image' && <img src={msg.content} alt="Media" style={mediaStyle} />}
                {msg.type === 'video' && <video src={msg.content} controls style={mediaStyle} />}
                {msg.type === 'audio' && <audio src={msg.content} controls style={{ maxWidth: '100%', height: '36px' }} />}

                <div style={timeStyle}>{msg.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={sendMessage} style={inputBarStyle}>
        <label style={iconBtnStyle} title="Fayl biriktirish">
          📎
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
          style={{ ...iconBtnStyle, background: recording ? '#ef4444' : '#334155', color: '#fff' }}
          title={recording ? "To'xtatish" : "Ovozli xabar"}
        >
          {recording ? '🛑' : '🎙️'}
        </button>

        <button type="submit" style={sendBtnStyle}>
          🚀
        </button>
      </form>
    </div>
  );
}

// Visual Styles
const loginContainerStyle = { display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' };
const loginCardStyle = { background: '#1e293b', padding: '36px 28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '340px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', border: '1px solid #334155', textAlign: 'center' };
const logoBadgeStyle = { fontSize: '32px', marginBottom: '12px' };

const chatContainerStyle = { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' };
const headerStyle = { padding: '12px 18px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const avatarStyle = { width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' };
const userBadgeStyle = { background: '#334155', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '500' };

const messageAreaStyle = { flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' };
const msgWrapperStyle = { display: 'flex', width: '100%' };
const msgBubbleStyle = { padding: '10px 14px', maxWidth: '78%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', position: 'relative' };
const senderNameStyle = { fontSize: '11px', color: '#38bdf8', fontWeight: '600', marginBottom: '4px' };
const timeStyle = { fontSize: '10px', opacity: 0.6, textAlign: 'right', marginTop: '4px' };
const mediaStyle = { maxWidth: '100%', borderRadius: '10px', marginTop: '4px', display: 'block' };

const inputBarStyle = { padding: '10px 14px', background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', gap: '8px', alignItems: 'center' };
const inputStyle = { padding: '12px 14px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: '#fff', outline: 'none', fontSize: '14px', marginBottom: '10px' };
const primaryBtnStyle = { padding: '12px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '15px' };
const iconBtnStyle = { padding: '10px 12px', borderRadius: '10px', background: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', fontSize: '16px' };
const sendBtnStyle = { padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '16px' };