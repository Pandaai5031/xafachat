import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

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

  // Matnli xabar yuborish
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('sendMessage', { username, type: 'text', content: message });
      setMessage('');
    }
  };

  // Rasm yoki Video yuborish (Base64)
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

  // Ovozli xabar yozishni boshlash
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

  // Ovozli xabarni to'xtatish va yuborish
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (!auth) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '30px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
          <h2 style={{ textAlign: 'center', margin: '0' }}>XAFA Chat</h2>
          <input type="text" placeholder="Nik / Ism" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Maxfiy kod (1234)" value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
          <button type="submit" style={btnStyle}>Kirish</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '15px 20px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>XAFA Chat Room</h3>
        <span><b>{username}</b></span>
      </header>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chat.map((msg) => (
          <div key={msg.id} style={{ alignSelf: msg.username === username ? 'flex-end' : 'flex-start', background: msg.username === username ? '#2563eb' : '#334155', padding: '10px 14px', borderRadius: '12px', maxWidth: '70%' }}>
            <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{msg.username} • {msg.time}</div>
            
            {msg.type === 'text' && <div>{msg.content}</div>}
            {msg.type === 'image' && <img src={msg.content} alt="Media" style={{ maxWidth: '100%', borderRadius: '8px' }} />}
            {msg.type === 'video' && <video src={msg.content} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />}
            {msg.type === 'audio' && <audio src={msg.content} controls style={{ width: '220px' }} />}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ padding: '12px', background: '#1e293b', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ cursor: 'pointer', background: '#334155', padding: '8px 12px', borderRadius: '6px' }}>
          📁
          <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>

        <input type="text" placeholder="Xabar yozing..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputStyle, flex: 1 }} />

        <button type="button" onClick={recording ? stopRecording : startRecording} style={{ ...btnStyle, background: recording ? '#ef4444' : '#10b981' }}>
          {recording ? '🛑 Stop' : '🎙 Voice'}
        </button>

        <button type="submit" style={btnStyle}>Yuborish</button>
      </form>
    </div>
  );
}

const inputStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', outline: 'none' };
const btnStyle = { padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 'bold' };