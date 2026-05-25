(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var TOKEN = script.getAttribute('data-token');
  var BASE_URL = script.src.replace('/widget.js', '');
  var SESSION_KEY = 'afp_session_' + TOKEN;

  if (!TOKEN) { console.warn('[AgentFlow] Missing data-token attribute.'); return; }

  // Session ID persisted in sessionStorage
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  var config = {
    style: 'whatsapp',
    primaryColor: '#25D366',
    position: 'bottom-right',
    greetingMessage: 'Hi! How can I help you today?',
    agentDisplayName: 'AI Assistant',
    isActive: true,
  };

  var messages = [];
  var isOpen = false;
  var isLoading = false;

  // ─── Style definitions per platform ────────────────────────────────────────
  var STYLES = {
    whatsapp: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.395 5.61L0 24l6.545-1.369A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.395l-.37-.22-3.882.813.826-3.77-.242-.388A9.937 9.937 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>', headerBg: '#075E54', name: 'WhatsApp' },
    messenger: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M12 0C5.374 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.626 0 12-4.974 12-11.111C24 4.975 18.626 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8.1l3.13 3.259L19.752 8.1l-6.559 6.863z"/></svg>', headerBg: '#0084FF', name: 'Messenger' },
    telegram: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>', headerBg: '#2AABEE', name: 'Telegram' },
    instagram: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>', headerBg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', name: 'Instagram' },
    custom: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>', headerBg: '#6b7280', name: 'Chat' },
  };

  function getStyle() { return STYLES[config.style] || STYLES.custom; }

  // ─── Load config from server ────────────────────────────────────────────────
  function loadConfig() {
    fetch(BASE_URL + '/api/chat/config/' + TOKEN)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        Object.assign(config, data);
        if (config.isActive) { render(); } else { console.info('[AgentFlow] Agent inactive.'); }
      })
      .catch(function () { config.isActive = true; render(); });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  function render() {
    injectStyles();
    createWidget();
    addGreeting();
  }

  function injectStyles() {
    if (document.getElementById('afp-styles')) return;
    var style = document.createElement('style');
    style.id = 'afp-styles';
    style.textContent = '\n' +
      '#afp-btn { position:fixed; ' + (config.position === 'bottom-left' ? 'left:20px' : 'right:20px') + '; bottom:20px; width:56px; height:56px; border-radius:50%; background:' + config.primaryColor + '; cursor:pointer; border:none; box-shadow:0 4px 16px rgba(0,0,0,.25); display:flex; align-items:center; justify-content:center; z-index:99998; transition:transform .2s; }\n' +
      '#afp-btn:hover { transform:scale(1.08); }\n' +
      '#afp-badge { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; border-radius:50%; width:18px; height:18px; font-size:11px; display:none; align-items:center; justify-content:center; font-family:sans-serif; }\n' +
      '#afp-window { position:fixed; ' + (config.position === 'bottom-left' ? 'left:20px' : 'right:20px') + '; bottom:88px; width:360px; max-width:calc(100vw - 32px); height:520px; max-height:calc(100vh - 110px); background:#fff; border-radius:16px; box-shadow:0 8px 40px rgba(0,0,0,.18); display:none; flex-direction:column; z-index:99999; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden; }\n' +
      '#afp-window.afp-open { display:flex; }\n' +
      '#afp-header { padding:14px 16px; background:' + config.primaryColor + '; color:#fff; display:flex; align-items:center; gap:10px; }\n' +
      '.afp-avatar { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; }\n' +
      '.afp-hname { font-size:15px; font-weight:600; }\n' +
      '.afp-hstatus { font-size:12px; opacity:.85; }\n' +
      '#afp-close { margin-left:auto; background:none; border:none; color:#fff; cursor:pointer; font-size:20px; line-height:1; padding:0; opacity:.8; }\n' +
      '#afp-close:hover { opacity:1; }\n' +
      '#afp-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; background:#f5f5f5; }\n' +
      '.afp-msg { max-width:80%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.45; word-wrap:break-word; }\n' +
      '.afp-msg.afp-user { background:' + config.primaryColor + '; color:#fff; border-bottom-right-radius:3px; align-self:flex-end; }\n' +
      '.afp-msg.afp-bot { background:#fff; color:#1a1a1a; border-bottom-left-radius:3px; align-self:flex-start; box-shadow:0 1px 2px rgba(0,0,0,.1); }\n' +
      '.afp-typing { display:flex; gap:4px; align-items:center; padding:10px 14px; background:#fff; border-radius:12px; border-bottom-left-radius:3px; align-self:flex-start; box-shadow:0 1px 2px rgba(0,0,0,.1); }\n' +
      '.afp-dot { width:7px; height:7px; background:#9ca3af; border-radius:50%; animation:afp-bounce .9s infinite; }\n' +
      '.afp-dot:nth-child(2){animation-delay:.15s}.afp-dot:nth-child(3){animation-delay:.3s}\n' +
      '@keyframes afp-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}\n' +
      '#afp-input-area { padding:12px; border-top:1px solid #e5e7eb; display:flex; gap:8px; background:#fff; }\n' +
      '#afp-input { flex:1; border:1px solid #d1d5db; border-radius:24px; padding:10px 16px; font-size:14px; outline:none; font-family:inherit; resize:none; max-height:100px; }\n' +
      '#afp-input:focus { border-color:' + config.primaryColor + '; }\n' +
      '#afp-send { width:40px; height:40px; border-radius:50%; background:' + config.primaryColor + '; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }\n' +
      '#afp-send svg { fill:#fff; width:18px; height:18px; }\n';
    document.head.appendChild(style);
  }

  function createWidget() {
    var s = getStyle();

    // Launcher button
    var btn = document.createElement('button');
    btn.id = 'afp-btn';
    btn.title = 'Chat with us';
    btn.innerHTML = s.icon + '<span id="afp-badge"></span>';
    btn.addEventListener('click', toggleWindow);
    document.body.appendChild(btn);

    // Chat window
    var win = document.createElement('div');
    win.id = 'afp-window';
    win.innerHTML =
      '<div id="afp-header">' +
        '<div class="afp-avatar">' + s.icon + '</div>' +
        '<div><div class="afp-hname">' + esc(config.agentDisplayName) + '</div><div class="afp-hstatus">Online · Replies instantly</div></div>' +
        '<button id="afp-close" title="Close">&#x2715;</button>' +
      '</div>' +
      '<div id="afp-messages"></div>' +
      '<div id="afp-input-area">' +
        '<textarea id="afp-input" rows="1" placeholder="Type a message…"></textarea>' +
        '<button id="afp-send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
      '</div>';
    document.body.appendChild(win);

    document.getElementById('afp-close').addEventListener('click', function () { setOpen(false); });
    document.getElementById('afp-send').addEventListener('click', sendMessage);
    var input = document.getElementById('afp-input');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    input.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px'; });
  }

  function addGreeting() {
    appendMessage('bot', config.greetingMessage);
  }

  function toggleWindow() { setOpen(!isOpen); }

  function setOpen(open) {
    isOpen = open;
    var win = document.getElementById('afp-window');
    if (win) { open ? win.classList.add('afp-open') : win.classList.remove('afp-open'); }
    var badge = document.getElementById('afp-badge');
    if (badge && open) { badge.style.display = 'none'; }
    if (open) {
      setTimeout(function () { var inp = document.getElementById('afp-input'); if (inp) inp.focus(); }, 100);
    }
  }

  function appendMessage(type, text) {
    var container = document.getElementById('afp-messages');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'afp-msg afp-' + type;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    messages.push({ role: type === 'user' ? 'user' : 'assistant', content: text });
  }

  function showTyping() {
    var container = document.getElementById('afp-messages');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'afp-typing';
    el.id = 'afp-typing';
    el.innerHTML = '<div class="afp-dot"></div><div class="afp-dot"></div><div class="afp-dot"></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('afp-typing');
    if (el) el.parentNode.removeChild(el);
  }

  function sendMessage() {
    var input = document.getElementById('afp-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    input.style.height = 'auto';
    appendMessage('user', text);
    isLoading = true;
    showTyping();

    fetch(BASE_URL + '/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, sessionId: sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        appendMessage('bot', data.reply || 'Sorry, I could not process your request.');
        isLoading = false;
        if (!isOpen) {
          var badge = document.getElementById('afp-badge');
          if (badge) { badge.style.display = 'flex'; badge.textContent = '1'; }
        }
      })
      .catch(function () {
        hideTyping();
        appendMessage('bot', 'Sorry, something went wrong. Please try again.');
        isLoading = false;
      });
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Init
  loadConfig();
})();
