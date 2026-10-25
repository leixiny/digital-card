// 内容与代码分离：所有文案来自 data.json，这里只负责渲染与交互
(function () {
  var toastEl = document.getElementById('toast');
  var toastTimer;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fillField(name, value) {
    document.querySelectorAll('[data-field="' + name + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 兼容非安全上下文（如 http 局域网访问）
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy') ? resolve() : reject();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  function renderProfile(data) {
    var profile = data.profile;
    fillField('eyebrow', profile.eyebrow);
    fillField('name', profile.name);
    fillField('tagline', profile.tagline);

    var primary = document.querySelector('[data-cta="primary"]');
    primary.textContent = profile.primaryCta.label;
    primary.setAttribute('href', profile.primaryCta.href);

    var secondary = document.querySelector('[data-cta="secondary"]');
    secondary.textContent = profile.secondaryCta.label;
    secondary.setAttribute('href', profile.secondaryCta.href);

    fillField('footer', profile.footer);
  }

  function renderSkills(skills) {
    fillField('skillsLabel', skills.label);
    fillField('skillsHeading', skills.heading);
    fillField('learning', skills.learning);

    var html = skills.groups.map(function (group) {
      var rows = group.items.map(function (item) {
        return '<li class="skill-row"><span class="skill-name">' + escapeHtml(item.name) +
          '</span><span class="skill-ev">' + escapeHtml(item.evidence) + '</span></li>';
      }).join('');
      return '<div class="skill-group"><h3>' + escapeHtml(group.name) +
        '</h3><ul class="skill-list">' + rows + '</ul></div>';
    }).join('');

    document.getElementById('skillGrid').innerHTML = html;
  }

  function renderWork(work) {
    fillField('workLabel', work.label);
    fillField('workHeading', work.heading);

    var html = work.projects.map(function (project) {
      var tags = project.tags.map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + '</span>';
      }).join('');

      return '<article class="work-card">' +
        '<h3 class="work-title">' + escapeHtml(project.title) + '</h3>' +
        '<p class="work-meta">' + escapeHtml(project.meta) + '</p>' +
        '<div class="work-line"><span class="row-label">背景</span><p>' + escapeHtml(project.background) + '</p></div>' +
        '<div class="work-line"><span class="row-label">行动</span><p>' + escapeHtml(project.action) + '</p></div>' +
        '<div class="work-result"><span class="row-label">结果</span><p>' + escapeHtml(project.result) + '</p></div>' +
        '<div class="tags">' + tags + '</div>' +
        '</article>';
    }).join('');

    document.getElementById('workList').innerHTML = html;
  }

  function renderContact(contact) {
    fillField('contactLabel', contact.label);
    fillField('contactHeading', contact.heading);

    var html = contact.items.map(function (item) {
      var value = item.href
        ? '<a class="cvalue" href="' + escapeHtml(item.href) + '"' +
          (item.download ? ' download' : '') + '>' + escapeHtml(item.value) + '</a>'
        : '<span class="cvalue">' + escapeHtml(item.value) + '</span>';

      var action = item.copy
        ? '<button class="cbtn" type="button" data-copy="' + escapeHtml(item.copy) +
          '" data-label="' + escapeHtml(item.label) + '">复制</button>'
        : '<a class="cbtn" href="' + escapeHtml(item.href || '#') + '"' +
          (item.download ? ' download' : ' target="_blank" rel="noopener"') + '>' +
          escapeHtml(item.actionLabel || '打开') + '</a>';

      return '<div class="contact-row"><span class="clabel">' + escapeHtml(item.label) +
        '</span>' + value + action + '</div>';
    }).join('');

    document.getElementById('contactList').innerHTML = html;

    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy')).then(function () {
          btn.classList.add('copied');
          btn.textContent = '已复制';
          showToast(btn.getAttribute('data-label') + ' 已复制到剪贴板');
          setTimeout(function () {
            btn.classList.remove('copied');
            btn.textContent = '复制';
          }, 1600);
        }).catch(function () {
          showToast('复制失败，请手动选择文本');
        });
      });
    });
  }

  function render(data) {
    renderProfile(data);
    renderSkills(data.skills);
    renderWork(data.work);
    renderContact(data.contact);
  }

  fetch('data.json')
    .then(function (res) {
      if (!res.ok) throw new Error('data.json ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      console.error(err);
      document.querySelector('main').insertAdjacentHTML('afterbegin',
        '<p style="padding:16px 0;color:#6a6f78;font-size:14px">内容加载失败：请通过本地服务器访问本页，' +
        '不要直接双击打开 HTML 文件。</p>');
    });
})();
