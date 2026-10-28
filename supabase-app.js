// Supabase 交互模块：点赞 / 访问计数 / 留言板（实时）
// 未配置 config.js 时优雅降级：显示提示、禁用输入
(async function () {
  var likeBtn = document.getElementById('likeBtn');
  var likeHeart = likeBtn ? likeBtn.querySelector('.like-heart') : null;
  var likeCount = document.getElementById('likeCount');
  var viewsCount = document.getElementById('viewsCount');
  var gbForm = document.getElementById('gbForm');
  var gbName = document.getElementById('gbName');
  var gbMessage = document.getElementById('gbMessage');
  var gbSubmit = document.getElementById('gbSubmit');
  var gbCount = document.getElementById('gbCount');
  var gbList = document.getElementById('gbList');
  var gbOffline = document.getElementById('gbOffline');

  var cfg = window.SUPABASE_CONFIG || {};
  var configured = cfg.url && cfg.anonKey &&
    cfg.url.indexOf('YOUR_') !== 0 && cfg.anonKey.indexOf('YOUR_') !== 0 &&
    cfg.url.indexOf('YOUR_') === -1 && cfg.anonKey.indexOf('YOUR_') === -1;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return ''; }
  }

  function renderMessage(row, prepend) {
    var existing = gbList.querySelector('[data-id="' + row.id + '"]');
    if (existing) return;
    var el = document.createElement('article');
    el.className = 'gb-item';
    el.setAttribute('data-id', row.id);
    el.innerHTML =
      '<div class="gb-item-head"><span class="gb-item-name">' + escapeHtml(row.name || '访客') +
      '</span><span class="gb-item-time">' + escapeHtml(fmtTime(row.created_at)) + '</span></div>' +
      '<p>' + escapeHtml(row.message) + '</p>';
    if (prepend && gbList.firstChild) {
      gbList.insertBefore(el, gbList.firstChild);
    } else {
      gbList.appendChild(el);
    }
    var empty = gbList.querySelector('.gb-empty');
    if (empty) empty.remove();
  }

  // 字数统计
  if (gbMessage && gbCount) {
    var sync = function () { gbCount.textContent = gbMessage.value.length + ' / 200'; };
    gbMessage.addEventListener('input', sync);
    sync();
  }

  if (!configured) {
    if (gbOffline) gbOffline.hidden = false;
    if (gbSubmit) gbSubmit.disabled = true;
    if (gbName) gbName.disabled = true;
    if (gbMessage) gbMessage.disabled = true;
    if (likeBtn) likeBtn.disabled = true;
    return;
  }

  var supabase;
  try {
    var mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = mod.createClient(cfg.url, cfg.anonKey);
  } catch (err) {
    console.error('Supabase SDK 加载失败', err);
    if (gbOffline) {
      gbOffline.hidden = false;
      gbOffline.textContent = 'Supabase SDK 加载失败，请检查网络后刷新重试。';
    }
    return;
  }

  // ---------- 点赞 ----------
  likeBtn.addEventListener('click', async function () {
    likeBtn.disabled = true;
    try {
      var value = await supabase.rpc('increment_stat', { stat_key: 'likes' });
      var n = Array.isArray(value) ? value[0] : value;
      if (typeof n === 'number') likeCount.textContent = n;
      likeHeart.textContent = '♥';
      likeBtn.classList.add('liked');
      setTimeout(function () { likeHeart.textContent = '♡'; likeBtn.classList.remove('liked'); }, 900);
    } catch (err) {
      console.error(err);
      window.showToast('点赞失败，稍后再试');
    } finally {
      likeBtn.disabled = false;
    }
  });

  // ---------- 访问计数（每个浏览器会话只 +1） ----------
  try {
    var viewed = sessionStorage.getItem('dc_viewed');
    if (!viewed) {
      sessionStorage.setItem('dc_viewed', '1');
      var v = await supabase.rpc('increment_stat', { stat_key: 'views' });
      var vn = Array.isArray(v) ? v[0] : v;
      viewsCount.textContent = typeof vn === 'number' ? vn : '—';
    } else {
      var res = await supabase.from('site_stats').select('value').eq('key', 'views').maybeSingle();
      viewsCount.textContent = res && res.data ? res.data.value : '—';
    }
    var lres = await supabase.from('site_stats').select('value').eq('key', 'likes').maybeSingle();
    likeCount.textContent = lres && lres.data ? lres.data.value : '—';
  } catch (err) {
    console.error('统计读取失败', err);
  }

  // ---------- 留言板 ----------
  try {
    var list = await supabase
      .from('guestbook')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (list.error) throw list.error;
    if (!list.data || list.data.length === 0) {
      gbList.innerHTML = '<p class="gb-empty"></p>';
      var emptyText = (await (await fetch('data.json')).json()).interaction.emptyHint;
      gbList.querySelector('.gb-empty').textContent = emptyText;
    } else {
      list.data.forEach(function (row) { renderMessage(row, false); });
    }
  } catch (err) {
    console.error('留言加载失败', err);
    gbList.innerHTML = '<p class="gb-empty">留言加载失败，请刷新重试。</p>';
  }

  // 实时接收新留言
  try {
    supabase
      .channel('guestbook-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook' },
        function (payload) { renderMessage(payload.new, true); })
      .subscribe();
  } catch (err) {
    console.warn('实时订阅不可用', err);
  }

  gbForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = gbName.value.trim().slice(0, 24) || '访客';
    var message = gbMessage.value.trim().slice(0, 200);
    if (!message) { window.showToast('先写点内容再发布'); return; }

    gbSubmit.disabled = true;
    try {
      var ins = await supabase.from('guestbook').insert({ name: name, message: message }).select().single();
      if (ins.error) throw ins.error;
      renderMessage(ins.data, true);
      gbMessage.value = '';
      gbCount.textContent = '0 / 200';
      window.showToast('留言已发布');
    } catch (err) {
      console.error(err);
      window.showToast('发布失败：' + (err.message || '请稍后再试'));
    } finally {
      gbSubmit.disabled = false;
    }
  });
})();
