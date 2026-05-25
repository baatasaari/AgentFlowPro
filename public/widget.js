(function () {
  'use strict';

  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var TOKEN = script.getAttribute('data-token');
  var BASE_URL = script.src.replace('/widget.js', '');
  var SESSION_KEY = 'afp_session_' + TOKEN;
  if (!TOKEN) { console.warn('[AgentFlow] Missing data-token.'); return; }

  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) { sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(SESSION_KEY, sessionId); }

  var config = { style: 'whatsapp', primaryColor: '#25D366', position: 'bottom-right', greetingMessage: 'Hi! How can I help you today?', agentDisplayName: 'AI Assistant', isActive: true, enableBooking: false };
  var bookingData = { services: [], staff: [], timezone: 'UTC', businessName: '' };
  var messages = [];
  var isOpen = false;
  var isLoading = false;
  var currentView = 'chat'; // 'chat' | 'booking'
  var bookingStep = 1; // 1: service, 2: staff, 3: date, 4: time, 5: details, 6: confirm
  var bookingSelection = {};

  var STYLES = {
    whatsapp:  { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.395 5.61L0 24l6.545-1.369A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.395l-.37-.22-3.882.813.826-3.77-.242-.388A9.937 9.937 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>' },
    messenger: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M12 0C5.374 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.626 0 12-4.974 12-11.111C24 4.975 18.626 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8.1l3.13 3.259L19.752 8.1l-6.559 6.863z"/></svg>' },
    telegram:  { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>' },
    instagram: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' },
    custom:    { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
  };

  function getStyleIcon() { return (STYLES[config.style] || STYLES.custom).icon; }

  function injectStyles() {
    if (document.getElementById('afp-css')) return;
    var pos = config.position === 'bottom-left' ? 'left:20px' : 'right:20px';
    var c = config.primaryColor;
    var style = document.createElement('style');
    style.id = 'afp-css';
    style.textContent =
      '#afp-btn{position:fixed;' + pos + ';bottom:20px;width:56px;height:56px;border-radius:50%;background:' + c + ';cursor:pointer;border:none;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform .2s}' +
      '#afp-btn:hover{transform:scale(1.08)}' +
      '#afp-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:11px;display:none;align-items:center;justify-content:center;font-family:sans-serif}' +
      '#afp-win{position:fixed;' + pos + ';bottom:88px;width:360px;max-width:calc(100vw - 32px);height:530px;max-height:calc(100vh - 110px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);display:none;flex-direction:column;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}' +
      '#afp-win.afp-open{display:flex}' +
      '#afp-hdr{padding:12px 14px;background:' + c + ';color:#fff;display:flex;align-items:center;gap:10px;flex-shrink:0}' +
      '.afp-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.afp-hn{font-size:14px;font-weight:600;line-height:1.2}' +
      '.afp-hs{font-size:11px;opacity:.85}' +
      '#afp-close{margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:0;opacity:.8;line-height:1}' +
      '#afp-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f5f5f5}' +
      '.afp-m{max-width:82%;padding:9px 13px;border-radius:12px;font-size:13.5px;line-height:1.45;word-wrap:break-word}' +
      '.afp-m.afp-u{background:' + c + ';color:#fff;border-bottom-right-radius:3px;align-self:flex-end}' +
      '.afp-m.afp-b{background:#fff;color:#1a1a1a;border-bottom-left-radius:3px;align-self:flex-start;box-shadow:0 1px 2px rgba(0,0,0,.1)}' +
      '.afp-bk-card{background:#fff;border-radius:10px;padding:10px 13px;align-self:flex-start;box-shadow:0 1px 4px rgba(0,0,0,.12);font-size:13px;max-width:85%}' +
      '.afp-bk-card p{margin:3px 0}' +
      '.afp-bk-btn{margin-top:8px;padding:7px 14px;background:' + c + ';color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit}' +
      '.afp-typing{display:flex;gap:4px;align-items:center;padding:9px 13px;background:#fff;border-radius:12px;border-bottom-left-radius:3px;align-self:flex-start;box-shadow:0 1px 2px rgba(0,0,0,.1)}' +
      '.afp-dot{width:7px;height:7px;background:#9ca3af;border-radius:50%;animation:afp-b .9s infinite}' +
      '.afp-dot:nth-child(2){animation-delay:.15s}.afp-dot:nth-child(3){animation-delay:.3s}' +
      '@keyframes afp-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
      '#afp-inp-area{padding:10px;border-top:1px solid #e5e7eb;display:flex;gap:7px;background:#fff;flex-shrink:0}' +
      '#afp-inp{flex:1;border:1px solid #d1d5db;border-radius:22px;padding:9px 15px;font-size:13.5px;outline:none;font-family:inherit;resize:none;max-height:90px}' +
      '#afp-inp:focus{border-color:' + c + '}' +
      '#afp-send-btn{width:38px;height:38px;border-radius:50%;background:' + c + ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '#afp-send-btn svg{fill:#fff;width:17px;height:17px}' +
      /* Booking view */
      '#afp-book{flex:1;overflow-y:auto;padding:14px;background:#f9fafb;display:none;flex-direction:column;gap:10px}' +
      '#afp-book.afp-show{display:flex}' +
      '.afp-book-hdr{font-size:14px;font-weight:700;color:#111;margin:0}' +
      '.afp-book-sub{font-size:12px;color:#6b7280;margin:0}' +
      '.afp-book-opts{display:flex;flex-direction:column;gap:8px}' +
      '.afp-opt{border:1px solid #e5e7eb;border-radius:10px;padding:10px 13px;cursor:pointer;background:#fff;text-align:left;transition:.15s}' +
      '.afp-opt:hover,.afp-opt.afp-sel{border-color:' + c + ';background:' + c + '0d}' +
      '.afp-opt-name{font-size:13.5px;font-weight:600;color:#111}' +
      '.afp-opt-sub{font-size:12px;color:#6b7280;margin-top:2px}' +
      '.afp-day-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}' +
      '.afp-day{border:1px solid #e5e7eb;border-radius:8px;padding:7px;cursor:pointer;background:#fff;text-align:center;font-size:12px;transition:.15s}' +
      '.afp-day:hover,.afp-day.afp-sel{border-color:' + c + ';background:' + c + '0d}' +
      '.afp-day-dow{font-weight:600;color:#374151}' +
      '.afp-day-date{color:#6b7280;font-size:11px}' +
      '.afp-time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}' +
      '.afp-time{border:1px solid #e5e7eb;border-radius:8px;padding:7px;cursor:pointer;background:#fff;text-align:center;font-size:12.5px;font-weight:600;color:#374151;transition:.15s}' +
      '.afp-time:hover,.afp-time.afp-sel{border-color:' + c + ';background:' + c + '0d}' +
      '.afp-inp-field{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px 11px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box}' +
      '.afp-inp-field:focus{border-color:' + c + '}' +
      '.afp-inp-label{font-size:12px;font-weight:600;color:#374151;margin:6px 0 4px}' +
      '.afp-book-actions{display:flex;gap:8px;margin-top:4px}' +
      '.afp-btn-pri{flex:1;padding:9px;background:' + c + ';color:#fff;border:none;border-radius:9px;cursor:pointer;font-size:13.5px;font-weight:600;font-family:inherit}' +
      '.afp-btn-sec{padding:9px 14px;background:#f3f4f6;color:#374151;border:none;border-radius:9px;cursor:pointer;font-size:13.5px;font-family:inherit}' +
      '.afp-success{text-align:center;padding:20px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}' +
      '.afp-success-icon{width:56px;height:56px;border-radius:50%;background:' + c + '20;display:flex;align-items:center;justify-content:center;font-size:26px}';
    document.head.appendChild(style);
  }

  function createWidget() {
    var btn = document.createElement('button');
    btn.id = 'afp-btn';
    btn.title = 'Chat with us';
    btn.innerHTML = getStyleIcon() + '<span id="afp-badge"></span>';
    btn.addEventListener('click', toggleWin);
    document.body.appendChild(btn);

    var win = document.createElement('div');
    win.id = 'afp-win';
    win.innerHTML =
      '<div id="afp-hdr">' +
        '<div class="afp-av">' + getStyleIcon() + '</div>' +
        '<div><div class="afp-hn">' + esc(config.agentDisplayName) + '</div><div class="afp-hs">Online · Replies instantly</div></div>' +
        (config.enableBooking ? '<button id="afp-book-toggle" style="margin-left:auto;margin-right:8px;background:rgba(255,255,255,.2);border:none;color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit">📅 Book</button>' : '') +
        '<button id="afp-close">✕</button>' +
      '</div>' +
      '<div id="afp-msgs"></div>' +
      '<div id="afp-book"></div>' +
      '<div id="afp-inp-area">' +
        '<textarea id="afp-inp" rows="1" placeholder="Type a message…"></textarea>' +
        '<button id="afp-send-btn"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
      '</div>';
    document.body.appendChild(win);

    document.getElementById('afp-close').addEventListener('click', function () { setOpen(false); });
    document.getElementById('afp-send-btn').addEventListener('click', sendMessage);
    var inp = document.getElementById('afp-inp');
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    inp.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 90) + 'px'; });
    if (config.enableBooking) {
      document.getElementById('afp-book-toggle').addEventListener('click', function () {
        if (currentView === 'chat') showBookingView();
        else showChatView();
      });
    }
  }

  function showChatView() {
    currentView = 'chat';
    var msgs = document.getElementById('afp-msgs'), book = document.getElementById('afp-book'), inp = document.getElementById('afp-inp-area');
    msgs.style.display = 'flex'; book.style.display = 'none'; inp.style.display = 'flex';
    var toggle = document.getElementById('afp-book-toggle');
    if (toggle) toggle.textContent = '📅 Book';
  }

  function showBookingView() {
    currentView = 'booking'; bookingStep = 1; bookingSelection = {};
    var msgs = document.getElementById('afp-msgs'), book = document.getElementById('afp-book'), inp = document.getElementById('afp-inp-area');
    msgs.style.display = 'none'; book.style.display = 'flex'; inp.style.display = 'none';
    var toggle = document.getElementById('afp-book-toggle');
    if (toggle) toggle.textContent = '💬 Chat';
    renderBookingStep();
  }

  function renderBookingStep() {
    var c = document.getElementById('afp-book');
    if (!c) return;
    c.innerHTML = '';

    if (bookingStep === 1) {
      c.innerHTML = '<p class="afp-book-hdr">📅 Book an Appointment</p><p class="afp-book-sub">Choose a service to get started</p><div class="afp-book-opts" id="afp-svc-list"></div>';
      var list = document.getElementById('afp-svc-list');
      if (!bookingData.services.length) { list.innerHTML = '<p style="font-size:13px;color:#6b7280;text-align:center;padding:20px">No services available for booking.</p>'; return; }
      bookingData.services.forEach(function (s) {
        var el = document.createElement('button');
        el.className = 'afp-opt';
        el.innerHTML = '<div class="afp-opt-name">' + esc(s.name) + '</div><div class="afp-opt-sub">' + (s.durationMinutes ? s.durationMinutes + ' min' : '') + (s.price && parseFloat(s.price) > 0 ? ' · ' + (s.currency || 'USD') + ' ' + parseFloat(s.price).toFixed(2) : '') + (s.description ? ' · ' + esc(s.description).slice(0, 50) : '') + '</div>';
        el.addEventListener('click', function () { bookingSelection.service = s; bookingStep = 2; renderBookingStep(); });
        list.appendChild(el);
      });
    } else if (bookingStep === 2) {
      c.innerHTML = '<p class="afp-book-hdr">' + esc(bookingSelection.service.name) + '</p><p class="afp-book-sub">Who would you like to see?</p><div class="afp-book-opts" id="afp-staff-list"></div>';
      var list2 = document.getElementById('afp-staff-list');
      // "Any available" option
      var anyEl = document.createElement('button');
      anyEl.className = 'afp-opt';
      anyEl.innerHTML = '<div class="afp-opt-name">Any available</div><div class="afp-opt-sub">We\'ll assign the best available team member</div>';
      anyEl.addEventListener('click', function () { bookingSelection.staff = null; bookingStep = 3; renderBookingStep(); });
      list2.appendChild(anyEl);
      bookingData.staff.forEach(function (s) {
        var el2 = document.createElement('button');
        el2.className = 'afp-opt';
        el2.innerHTML = '<div class="afp-opt-name">' + esc(s.name) + (s.role ? ' <span style="font-weight:400;color:#6b7280;">— ' + esc(s.role) + '</span>' : '') + '</div>' + (s.speciality ? '<div class="afp-opt-sub">' + esc(s.speciality) + '</div>' : '');
        el2.addEventListener('click', function () { bookingSelection.staff = s; bookingStep = 3; renderBookingStep(); });
        list2.appendChild(el2);
      });
      c.innerHTML += '<div class="afp-book-actions"><button class="afp-btn-sec" onclick="void(0)" id="afp-back-2">← Back</button></div>';
      document.getElementById('afp-back-2').addEventListener('click', function () { bookingStep = 1; renderBookingStep(); });
    } else if (bookingStep === 3) {
      // Date picker — next 14 days
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dates = [];
      for (var i = 1; i <= 14; i++) { var d = new Date(Date.now() + i * 86400000); dates.push(d); }
      c.innerHTML = '<p class="afp-book-hdr">Choose a Date</p><p class="afp-book-sub">Available in the next 14 days</p><div class="afp-day-grid" id="afp-date-grid"></div><div class="afp-book-actions" style="margin-top:8px"><button class="afp-btn-sec" id="afp-back-3">← Back</button></div>';
      var grid = document.getElementById('afp-date-grid');
      dates.forEach(function (d) {
        var el = document.createElement('button');
        el.className = 'afp-day';
        el.innerHTML = '<div class="afp-day-dow">' + days[d.getDay()] + '</div><div class="afp-day-date">' + months[d.getMonth()] + ' ' + d.getDate() + '</div>';
        var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        el.addEventListener('click', function () { bookingSelection.date = dateStr; bookingStep = 4; loadSlotsAndRender(); });
        grid.appendChild(el);
      });
      document.getElementById('afp-back-3').addEventListener('click', function () { bookingStep = 2; renderBookingStep(); });
    } else if (bookingStep === 4) {
      c.innerHTML = '<p class="afp-book-hdr">Choose a Time</p><p class="afp-book-sub">' + bookingSelection.date + '</p><div style="text-align:center;padding:20px;color:#6b7280;font-size:13px" id="afp-slots-container">Loading…</div><div class="afp-book-actions" style="margin-top:8px"><button class="afp-btn-sec" id="afp-back-4">← Back</button></div>';
      document.getElementById('afp-back-4').addEventListener('click', function () { bookingStep = 3; renderBookingStep(); });
    } else if (bookingStep === 5) {
      c.innerHTML =
        '<p class="afp-book-hdr">Your Details</p>' +
        '<p class="afp-book-sub">' + esc(bookingSelection.service?.name || '') + ' · ' + bookingSelection.date + ' at ' + (bookingSelection.slot?.startTime || '') + '</p>' +
        '<div><p class="afp-inp-label">Full Name *</p><input class="afp-inp-field" id="afp-cname" placeholder="Jane Smith" /></div>' +
        '<div><p class="afp-inp-label">Email *</p><input class="afp-inp-field" id="afp-cemail" type="email" placeholder="jane@example.com" /></div>' +
        '<div><p class="afp-inp-label">Phone</p><input class="afp-inp-field" id="afp-cphone" placeholder="+1 555 000 0000" /></div>' +
        '<div><p class="afp-inp-label">Notes</p><textarea class="afp-inp-field" id="afp-cnotes" rows="2" placeholder="Anything we should know?" style="resize:none"></textarea></div>' +
        '<div class="afp-book-actions">' +
        '<button class="afp-btn-sec" id="afp-back-5">← Back</button>' +
        '<button class="afp-btn-pri" id="afp-confirm-btn">Review & Confirm</button>' +
        '</div>';
      document.getElementById('afp-back-5').addEventListener('click', function () { bookingStep = 4; loadSlotsAndRender(); });
      document.getElementById('afp-confirm-btn').addEventListener('click', function () {
        var name = document.getElementById('afp-cname').value.trim();
        var email = document.getElementById('afp-cemail').value.trim();
        var phone = document.getElementById('afp-cphone').value.trim();
        var notes = document.getElementById('afp-cnotes').value.trim();
        if (!name || !email) { alert('Please enter your name and email.'); return; }
        if (!/\S+@\S+\.\S+/.test(email)) { alert('Please enter a valid email address.'); return; }
        bookingSelection.customer = { name: name, email: email, phone: phone, notes: notes };
        bookingStep = 6; renderBookingStep();
      });
    } else if (bookingStep === 6) {
      var sl = bookingSelection.slot;
      var svc = bookingSelection.service;
      var st = bookingSelection.staff;
      c.innerHTML =
        '<p class="afp-book-hdr">Confirm Booking</p>' +
        '<div style="background:#fff;border-radius:10px;padding:14px;font-size:13px;">' +
        '<p style="font-weight:700;margin:0 0 10px;font-size:14px;">' + esc(svc?.name || 'Appointment') + '</p>' +
        '<p style="margin:5px 0;color:#374151;">📅 ' + bookingSelection.date + ' at ' + (sl?.startTime || '') + '</p>' +
        (st ? '<p style="margin:5px 0;color:#374151;">👤 ' + esc(st.name) + '</p>' : '') +
        '<p style="margin:5px 0;color:#374151;">👤 ' + esc(bookingSelection.customer.name) + '</p>' +
        '<p style="margin:5px 0;color:#374151;">✉️ ' + esc(bookingSelection.customer.email) + '</p>' +
        (svc?.price && parseFloat(svc.price) > 0 ? '<p style="margin:5px 0;color:#374151;">💰 ' + (svc.currency || 'USD') + ' ' + parseFloat(svc.price).toFixed(2) + '</p>' : '') +
        '</div>' +
        '<div class="afp-book-actions">' +
        '<button class="afp-btn-sec" id="afp-back-6">← Edit</button>' +
        '<button class="afp-btn-pri" id="afp-submit-btn">Confirm Booking</button>' +
        '</div>';
      document.getElementById('afp-back-6').addEventListener('click', function () { bookingStep = 5; renderBookingStep(); });
      document.getElementById('afp-submit-btn').addEventListener('click', submitBooking);
    }
  }

  function loadSlotsAndRender() {
    var c = document.getElementById('afp-book');
    c.innerHTML = '<p class="afp-book-hdr">Choose a Time</p><p class="afp-book-sub">' + bookingSelection.date + '</p><div style="text-align:center;padding:20px;color:#6b7280;font-size:13px">Loading availability…</div>';
    var url = BASE_URL + '/api/booking/slots/' + TOKEN + '?date=' + bookingSelection.date + (bookingSelection.service ? '&serviceId=' + bookingSelection.service.id : '') + (bookingSelection.staff ? '&staffId=' + bookingSelection.staff.id : '');
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (slots) {
        c.innerHTML = '';
        var header = document.createElement('p'); header.className = 'afp-book-hdr'; header.textContent = 'Choose a Time';
        var sub = document.createElement('p'); sub.className = 'afp-book-sub'; sub.textContent = bookingSelection.date;
        c.appendChild(header); c.appendChild(sub);
        if (!slots.length) {
          var np = document.createElement('p'); np.style.cssText = 'font-size:13px;color:#6b7280;text-align:center;padding:16px'; np.textContent = 'No slots available on this date. Please pick another date.';
          c.appendChild(np);
        } else {
          var grid = document.createElement('div'); grid.className = 'afp-time-grid'; c.appendChild(grid);
          slots.forEach(function (s) {
            var el = document.createElement('button'); el.className = 'afp-time';
            el.textContent = s.startTime; el.title = (s.staffName || '') + ' · ' + s.startTime + '–' + s.endTime;
            el.addEventListener('click', function () { bookingSelection.slot = s; if (!bookingSelection.staff && s.staffId) bookingSelection.staff = { id: s.staffId, name: s.staffName }; bookingStep = 5; renderBookingStep(); });
            grid.appendChild(el);
          });
        }
        var actions = document.createElement('div'); actions.className = 'afp-book-actions'; actions.style.marginTop = '8px';
        var back = document.createElement('button'); back.className = 'afp-btn-sec'; back.textContent = '← Back';
        back.addEventListener('click', function () { bookingStep = 3; renderBookingStep(); });
        actions.appendChild(back); c.appendChild(actions);
      })
      .catch(function () {
        var p = document.createElement('p'); p.style.cssText = 'font-size:13px;color:#ef4444;text-align:center;padding:16px'; p.textContent = 'Failed to load availability. Please try again.';
        c.appendChild(p);
      });
  }

  function submitBooking() {
    var btn = document.getElementById('afp-submit-btn');
    if (btn) { btn.textContent = 'Booking…'; btn.disabled = true; }
    var sl = bookingSelection.slot;
    var svc = bookingSelection.service;
    var dateTime = bookingSelection.date + 'T' + (sl?.startTime || '09:00') + ':00Z';
    var payload = {
      customerName: bookingSelection.customer.name,
      customerEmail: bookingSelection.customer.email,
      customerPhone: bookingSelection.customer.phone || undefined,
      customerNotes: bookingSelection.customer.notes || undefined,
      serviceId: svc?.id,
      staffId: bookingSelection.staff?.id,
      startsAt: dateTime,
      source: 'widget',
    };
    fetch(BASE_URL + '/api/booking/create/' + TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) { alert(res.error); if (btn) { btn.textContent = 'Confirm Booking'; btn.disabled = false; } return; }
        showBookingSuccess();
      })
      .catch(function () {
        alert('Booking failed. Please try again or contact us directly.');
        if (btn) { btn.textContent = 'Confirm Booking'; btn.disabled = false; }
      });
  }

  function showBookingSuccess() {
    var c = document.getElementById('afp-book');
    c.innerHTML =
      '<div class="afp-success">' +
      '<div class="afp-success-icon">✓</div>' +
      '<p style="font-size:18px;font-weight:700;margin:0;color:#111">Booking Confirmed!</p>' +
      '<p style="font-size:13px;color:#6b7280;text-align:center;margin:0">A confirmation has been sent to ' + esc(bookingSelection.customer?.email || '') + '</p>' +
      '<div style="background:#fff;border-radius:10px;padding:12px 16px;width:100%;box-sizing:border-box;font-size:13px;">' +
      '<p style="margin:4px 0;font-weight:600;">' + esc(bookingSelection.service?.name || 'Appointment') + '</p>' +
      '<p style="margin:4px 0;color:#374151;">📅 ' + bookingSelection.date + ' at ' + (bookingSelection.slot?.startTime || '') + '</p>' +
      (bookingSelection.staff ? '<p style="margin:4px 0;color:#374151;">👤 ' + esc(bookingSelection.staff.name) + '</p>' : '') +
      '</div>' +
      '<button class="afp-btn-sec" id="afp-back-chat">← Back to chat</button>' +
      '</div>';
    document.getElementById('afp-back-chat').addEventListener('click', function () { showChatView(); addGreeting('Your booking is confirmed! Is there anything else I can help you with?'); });
  }

  function addGreeting(msg) {
    appendMsg('b', msg || config.greetingMessage);
  }

  function toggleWin() { setOpen(!isOpen); }
  function setOpen(open) {
    isOpen = open;
    var win = document.getElementById('afp-win');
    if (win) open ? win.classList.add('afp-open') : win.classList.remove('afp-open');
    if (open) { var badge = document.getElementById('afp-badge'); if (badge) badge.style.display = 'none'; setTimeout(function () { var i = document.getElementById('afp-inp'); if (i && currentView === 'chat') i.focus(); }, 100); }
  }

  function appendMsg(type, text) {
    var c = document.getElementById('afp-msgs');
    if (!c) return;
    var el = document.createElement('div');
    el.className = 'afp-m afp-' + type;
    el.textContent = text;
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }

  function appendBookingCard(data) {
    var c = document.getElementById('afp-msgs');
    if (!c) return;
    var el = document.createElement('div');
    el.className = 'afp-bk-card';
    el.innerHTML = '<p style="font-weight:700;margin:0 0 4px">✓ Appointment Confirmed</p><p>Service: ' + esc(data.service || 'Appointment') + '</p><p>Date: ' + new Date(data.startsAt).toLocaleString() + '</p><p>Confirmation #' + data.id + '</p>';
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }

  function showTyping() {
    var c = document.getElementById('afp-msgs');
    var el = document.createElement('div'); el.className = 'afp-typing'; el.id = 'afp-typing';
    el.innerHTML = '<div class="afp-dot"></div><div class="afp-dot"></div><div class="afp-dot"></div>';
    c.appendChild(el); c.scrollTop = c.scrollHeight;
  }
  function hideTyping() { var el = document.getElementById('afp-typing'); if (el) el.parentNode.removeChild(el); }

  function sendMessage() {
    var inp = document.getElementById('afp-inp');
    if (!inp) return;
    var text = inp.value.trim();
    if (!text || isLoading) return;
    inp.value = ''; inp.style.height = 'auto';
    appendMsg('u', text);
    isLoading = true; showTyping();
    fetch(BASE_URL + '/api/chat/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, sessionId: sessionId, message: text }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        hideTyping();
        appendMsg('b', d.reply || 'Sorry, I could not process your request.');
        if (d.bookingConfirmed) appendBookingCard(d.bookingConfirmed);
        isLoading = false;
        if (!isOpen) { var badge = document.getElementById('afp-badge'); if (badge) { badge.style.display = 'flex'; badge.textContent = '1'; } }
      })
      .catch(function () { hideTyping(); appendMsg('b', 'Sorry, something went wrong. Please try again.'); isLoading = false; });
  }

  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function loadConfig() {
    fetch(BASE_URL + '/api/chat/config/' + TOKEN)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        Object.assign(config, d);
        if (config.enableBooking) {
          fetch(BASE_URL + '/api/booking/info/' + TOKEN).then(function (r) { return r.json(); }).then(function (bd) { Object.assign(bookingData, bd); }).catch(function () {});
        }
        if (config.isActive) { injectStyles(); createWidget(); addGreeting(); }
      })
      .catch(function () { injectStyles(); createWidget(); addGreeting(); });
  }

  loadConfig();
})();
