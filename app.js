/* ---------------------------------------------------------------------------
 * app.js —— 页面交互
 *   1. 字号 / 行高 / 等宽数字
 *   2. 字体面板：检测系统字体、切换西文与中文、载入本地字体文件
 *   3. 由本地服务器（node build.mjs --serve）调用系统文件资源管理器
 * 由 build.mjs 内联进 index.html，DEFAULTS 由构建时注入。
 * --------------------------------------------------------------------------- */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var GENERIC = [
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
    'inherit', 'initial', 'default'
  ];

  var STORAGE_KEY = 'font-test/fonts';

  /* queryLocalFonts 不可用时，用 canvas 探测这些常见字体族 */
  var PROBE_LATIN = [
    'Arial', 'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Baskerville', 'Book Antiqua',
    'Bookman Old Style', 'Calibri', 'Cambria', 'Candara', 'Cascadia Code', 'Cascadia Mono',
    'Century', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
    'Courier New', 'Franklin Gothic Medium', 'Futura', 'Garamond', 'Georgia', 'Gill Sans MT',
    'Helvetica', 'Helvetica Neue', 'Impact', 'Inter', 'JetBrains Mono', 'Lucida Console',
    'Lucida Sans Unicode', 'Menlo', 'Monaco', 'Optima', 'Palatino Linotype', 'Roboto',
    'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Variable', 'SF Pro Text',
    'SF Pro Display', 'SF Mono', 'Sitka Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
    'Verdana', 'Source Code Pro', 'Fira Code', 'Noto Sans', 'Noto Serif'
  ];

  var PROBE_CJK = [
    'Microsoft YaHei', 'Microsoft YaHei UI', 'Microsoft JhengHei', 'SimSun', 'NSimSun',
    'SimHei', 'KaiTi', 'FangSong', 'DengXian', '微软雅黑', '宋体', '黑体', '楷体', '仿宋',
    '等线', 'PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Heiti SC', 'Songti SC',
    'STHeiti', 'STSong', 'Source Han Sans SC', 'Source Han Sans CN', 'Source Han Serif SC',
    'Source Han Serif CN', 'Noto Sans SC', 'Noto Serif SC', 'Noto Sans CJK SC',
    'Noto Serif CJK SC', 'WenQuanYi Micro Hei', 'LXGW WenKai', '霞鹜文楷', 'Yu Gothic',
    'Meiryo', 'MS Mincho', 'MS PGothic', 'Malgun Gothic', 'Apple SD Gothic Neo'
  ];

  var collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base', numeric: true });

  /* ======================================================== 字体栈小工具 */

  function quoteFamily(name) {
    return '"' + String(name).replace(/"/g, '\\"') + '"';
  }

  function splitFamilies(stack) {
    return String(stack || '')
      .split(',')
      .map(function (name) {
        return name.trim().replace(/^["']|["']$/g, '');
      })
      .filter(Boolean);
  }

  function isGeneric(name) {
    return GENERIC.indexOf(String(name).toLowerCase()) !== -1;
  }

  function formatStack(stack) {
    return splitFamilies(stack)
      .filter(function (name) {
        return !isGeneric(name);
      })
      .map(quoteFamily)
      .join(', ');
  }

  /* ============================================================ 页面状态 */

  var state = {
    latin: DEFAULTS.latin,
    cjk: DEFAULTS.cjk,
    unified: DEFAULTS.unified || '', // 非空 = 中西文共用这一个字体
    compare: '', // 分屏对比右侧（B）的字体；空 = 用 font.toml 默认栈
    slot: 'latin',
    loaded: [] // [{ family, faces: ['400 normal', ...] }]
  };

  var systemFonts = [];
  var statusTimer = null;

  function withGeneric(stack) {
    return /,\s*(sans-serif|serif|monospace)\s*$/.test(stack) ? stack : stack + ', sans-serif';
  }

  function textStack() {
    if (state.unified) return withGeneric(formatStack(state.unified));
    var parts = [formatStack(state.latin), formatStack(state.cjk)].filter(Boolean);
    if (!parts.length) return withGeneric(formatStack(DEFAULTS.mono));
    return withGeneric(parts.join(', '));
  }

  /* font.toml 里配置的原始字体栈，用作对比右栏没指定字体时的参照 */
  function defaultStack() {
    if (DEFAULTS.unified) return withGeneric(formatStack(DEFAULTS.unified));
    var parts = [formatStack(DEFAULTS.latin), formatStack(DEFAULTS.cjk)].filter(Boolean);
    return withGeneric(parts.join(', ') || formatStack(DEFAULTS.mono));
  }

  function compareStack() {
    return state.compare ? withGeneric(formatStack(state.compare)) : defaultStack();
  }

  function applyFonts() {
    var stack = textStack();
    root.style.setProperty('--font-text', stack);
    root.style.setProperty('--font-head', stack);

    var showLatin = state.unified || state.latin;
    var showCjk = state.unified || state.cjk;
    var latinEl = $('stack-latin');
    var cjkEl = $('stack-cjk');
    if (latinEl) {
      latinEl.textContent = showLatin;
      latinEl.parentNode.title = state.unified ? '中西统一字体' : showLatin;
    }
    if (cjkEl) {
      cjkEl.textContent = showCjk;
      cjkEl.parentNode.title = state.unified ? '中西统一字体' : showCjk;
    }
    refreshPaneFonts();
    updateSlotLabel();
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          latin: state.latin,
          cjk: state.cjk,
          unified: state.unified,
          compare: state.compare
        })
      );
    } catch {
      /* 隐私模式或禁用存储时忽略 */
    }
  }

  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return;
      if (saved.latin) state.latin = saved.latin;
      if (saved.cjk) state.cjk = saved.cjk;
      if (typeof saved.unified === 'string') state.unified = saved.unified;
      if (typeof saved.compare === 'string') state.compare = saved.compare;
    } catch {
      /* 忽略损坏的存档 */
    }
  }

  function status(message) {
    var el = $('panel-status');
    if (!el) return;
    el.textContent = message || '';
    clearTimeout(statusTimer);
    if (message) statusTimer = setTimeout(function () {
      el.textContent = '';
    }, 6000);
  }

  /* ============================================== 字号 / 行高 / 等宽数字 */

  function initControls() {
    var size = $('ctl-size');
    var lh = $('ctl-lh');
    var tnum = $('ctl-tnum');
    var sizeVal = $('ctl-size-val');
    var lhVal = $('ctl-lh-val');
    if (!size || !lh || !tnum) return;

    function sync() {
      root.style.setProperty('--fs', size.value + 'px');
      root.style.setProperty('--lh', lh.value);
      sizeVal.textContent = size.value + 'px';
      lhVal.textContent = Number(lh.value).toFixed(2);

      var feats = getComputedStyle(root).getPropertyValue('--features');
      if (tnum.checked && feats.indexOf('"tnum"') === -1) {
        root.style.setProperty('--features', feats + ', "tnum" 1');
      } else if (!tnum.checked) {
        root.style.setProperty('--features', feats.replace(/,\s*"tnum"\s*1/g, ''));
      }
    }

    size.addEventListener('input', sync);
    lh.addEventListener('input', sync);
    tnum.addEventListener('change', sync);

    $('ctl-reset').addEventListener('click', function () {
      root.style.removeProperty('--fs');
      root.style.removeProperty('--lh');
      root.style.removeProperty('--features');
      var computed = getComputedStyle(root);
      size.value = parseFloat(computed.getPropertyValue('--fs'));
      lh.value = parseFloat(computed.getPropertyValue('--lh'));
      tnum.checked = !!DEFAULTS.tabularNumbers;
      sizeVal.textContent = size.value + 'px';
      lhVal.textContent = Number(lh.value).toFixed(2);
    });
  }

  /* ================================================== 字体可用性探测 */

  var probeCanvas = null;

  function probeFamily(family) {
    if (!probeCanvas) {
      probeCanvas = document.createElement('canvas');
      probeCanvas.width = 10;
      probeCanvas.height = 10;
    }
    var ctx = probeCanvas.getContext('2d');
    if (!ctx) return true;
    var probe = 'mmmmmmmmmmlli WWWW 0123456789 字体测试';
    var bases = ['monospace', 'sans-serif', 'serif'];
    for (var i = 0; i < bases.length; i++) {
      ctx.font = '72px ' + bases[i];
      var before = ctx.measureText(probe).width;
      ctx.font = '72px ' + quoteFamily(family) + ', ' + bases[i];
      var after = ctx.measureText(probe).width;
      if (Math.abs(after - before) > 0.01) return true;
    }
    return false;
  }

  function probeCommonFonts() {
    var seen = [];
    return PROBE_LATIN.concat(PROBE_CJK).filter(function (family) {
      if (seen.indexOf(family) !== -1) return false;
      seen.push(family);
      return true;
    }).filter(probeFamily).sort(collator.compare);
  }

  /* ==================================================== 系统字体检测 */

  function detectSystemFonts() {
    var button = $('btn-detect');
    var source = $('panel-source');
    button.disabled = true;
    source.textContent = '正在检测…';

    if (typeof window.queryLocalFonts === 'function') {
      window
        .queryLocalFonts()
        .then(function (fonts) {
          var families = [];
          fonts.forEach(function (font) {
            if (font.family && families.indexOf(font.family) === -1) families.push(font.family);
          });
          families.sort(collator.compare);
          systemFonts = families;
          source.textContent =
            'Local Font Access API：本机共 ' + families.length + ' 个系统字体族（已按名称排序）。';
        })
        .catch(function (error) {
          systemFonts = probeCommonFonts();
          var reason = (error && (error.name || error.message)) || '未知错误';
          source.textContent =
            '枚举失败（' + reason + '），改用 canvas 探测：找到 ' +
            systemFonts.length + ' 个可用的常见字体族。';
        })
        .then(function () {
          button.disabled = false;
          renderList();
        });
      return;
    }

    systemFonts = probeCommonFonts();
    source.textContent =
      '当前环境不支持 Local Font Access API（打开 file:// 时不可用，用 node build.mjs --serve 从 localhost 访问即可枚举全部字体）' +
      '，已用 canvas 探测：找到 ' + systemFonts.length + ' 个可用的常见字体族。';
    button.disabled = false;
    renderList();
  }

  /* ======================================================== 字体列表 */

  function updateSlotLabel() {
    var label = $('slot-current');
    if (!label) return;
    if (state.slot === 'both') {
      label.textContent = state.unified
        ? '中西统一：' + splitFamilies(state.unified).join(' → ')
        : '中西尚未统一（点字体即同时用于西文与中文）';
      return;
    }
    if (state.slot === 'compare') {
      label.textContent =
        '对比 B：' +
        (state.compare ? splitFamilies(state.compare).join(' → ') : '未设置（用 font.toml 默认）');
      return;
    }
    var current = splitFamilies(state[state.slot]).join(' → ');
    var note = state.unified ? '（当前为中西统一，选字体会改用分栏）' : '';
    label.textContent = (state.slot === 'latin' ? '西文' : '中文') + '：' + current + note;
  }

  function slotFamilies(slot) {
    if (slot === 'both') return splitFamilies(state.unified);
    if (slot === 'compare') return splitFamilies(state.compare);
    if (state.unified) return []; // 统一模式下分槽设置不生效
    return splitFamilies(state[slot]);
  }

  function chooseFont(family) {
    if (!family) return;
    var value = quoteFamily(family);
    if (state.slot === 'both') {
      state.unified = value;
    } else if (state.slot === 'compare') {
      state.compare = value;
    } else {
      state.unified = '';
      state[state.slot] = value;
    }
    applyFonts();
    persist();
    renderList();

    var target =
      state.slot === 'both'
        ? '西文与中文'
        : state.slot === 'compare'
          ? '对比栏 B 的'
          : state.slot === 'latin'
            ? '西文'
            : '中文';
    status('已把「' + family + '」设为' + target + '字体');
  }

  function renderList() {
    var list = $('font-list');
    if (!list) return;

    var keyword = ($('font-search').value || '').trim().toLowerCase();
    var entries = [];

    state.loaded.forEach(function (entry) {
      entries.push({ family: entry.family, tag: '已载入 ' + entry.faces.length });
    });
    systemFonts.forEach(function (family) {
      entries.push({ family: family, tag: '' });
    });

    list.textContent = '';
    var shown = 0;

    entries.forEach(function (entry) {
      if (keyword && entry.family.toLowerCase().indexOf(keyword) === -1) return;
      shown++;

      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fitem';
      button.style.fontFamily = quoteFamily(entry.family);

      var name = document.createElement('b');
      name.textContent = entry.family;
      button.appendChild(name);

      var preview = document.createElement('i');
      preview.textContent = '永 Aa 0123';
      button.appendChild(preview);

      if (entry.tag) {
        var tag = document.createElement('span');
        tag.className = 'ftag';
        tag.textContent = entry.tag;
        button.appendChild(tag);
      }

      var active = slotFamilies(state.slot).indexOf(entry.family) !== -1;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.addEventListener('click', function () {
        chooseFont(entry.family);
      });

      item.appendChild(button);
      list.appendChild(item);
    });

    $('panel-count').textContent = '显示 ' + shown + ' / ' + entries.length + ' 个字体族';
  }

  /* ================================================ 载入本地字体文件 */

  var WEIGHT_KEYWORDS = [
    [/extralight|ultralight/i, 200],
    [/semibold|demibold/i, 600],
    [/extrabold|ultrabold/i, 800],
    [/hairline|thin/i, 100],
    [/light/i, 300],
    [/medium/i, 500],
    [/black|heavy/i, 900],
    [/bold/i, 700],
    [/regular|normal|book|roman/i, 400]
  ];

  var NAME_NOISE = /(thin|extralight|ultralight|light|medium|semibold|demibold|extrabold|ultrabold|black|heavy|bold|regular|normal|book|roman|italic|oblique|slanted)/gi;

  function classifyFile(fileName) {
    var base = fileName.replace(/\.[^.]+$/, '');
    var weight = 400;
    for (var i = 0; i < WEIGHT_KEYWORDS.length; i++) {
      if (WEIGHT_KEYWORDS[i][0].test(base)) {
        weight = WEIGHT_KEYWORDS[i][1];
        break;
      }
    }
    var family = base
      .replace(NAME_NOISE, '')
      .replace(/[-_\s]{2,}/g, ' ')
      .replace(/^[-_\s]+|[-_\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!family) family = base;
    return {
      family: family,
      weight: weight,
      style: /italic|oblique|slanted/i.test(base) ? 'italic' : 'normal'
    };
  }

  var loadedUrls = [];

  function loadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    status('正在载入 ' + files.length + ' 个字体文件…');

    var tasks = files.map(function (file) {
      var info = classifyFile(file.name);
      var url = URL.createObjectURL(file);
      loadedUrls.push(url);
      var face = new FontFace(info.family, 'url(' + JSON.stringify(url) + ')', {
        weight: String(info.weight),
        style: info.style
      });
      return face
        .load()
        .then(function (loaded) {
          document.fonts.add(loaded);
          return { info: info, ok: true };
        })
        .catch(function () {
          return { info: info, ok: false };
        });
    });

    Promise.all(tasks).then(function (results) {
      var added = [];
      var failed = [];

      results.forEach(function (result) {
        if (!result.ok) {
          failed.push(result.info.family);
          return;
        }
        var info = result.info;
        var entry = null;
        for (var i = 0; i < state.loaded.length; i++) {
          if (state.loaded[i].family === info.family) entry = state.loaded[i];
        }
        if (!entry) {
          entry = { family: info.family, faces: [] };
          state.loaded.push(entry);
        }
        var label = info.weight + ' ' + info.style;
        if (entry.faces.indexOf(label) === -1) entry.faces.push(label);
        if (added.indexOf(info.family) === -1) added.push(info.family);
      });

      if (added.length) {
        chooseFont(added[0]);
        status('已载入：' + added.join('、') + (failed.length ? '（失败：' + failed.join('、') + '）' : ''));
      } else {
        status('没有可用的字体文件' + (failed.length ? '：' + failed.join('、') : ''));
        renderList();
      }
    });
  }

  /* ================================================== 打开字体文件夹 */

  var serverInfo = null;

  function detectServer() {
    if (!window.fetch) return;
    fetch('api/health')
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (info) {
        if (!info || !info.ok) return;
        serverInfo = info;
        var button = $('btn-reveal');
        if (!button) return;
        button.hidden = false;
        button.title = '在文件资源管理器中打开：' + (info.fontDirs || []).join(' ／ ');
      })
      .catch(function () {
        /* file:// 或无服务器时静默忽略 */
      });
  }

  function revealFontDir() {
    if (!serverInfo) {
      status('需要本地服务器：node build.mjs --serve，然后从 http://localhost 打开');
      return;
    }
    fetch('api/reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dir: serverInfo.fontDirs[0] })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        status(result.ok ? '已打开 ' + result.dir : '打开失败：' + (result.error || '未知原因'));
      })
      .catch(function () {
        status('无法调用本地服务器');
      });
  }

  /* ==================================================== 面板初始化 */

  function setSlotButtons() {
    var panel = $('font-panel');
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll('[data-slot]'), function (button) {
      button.setAttribute(
        'aria-pressed',
        String(button.getAttribute('data-slot') === state.slot)
      );
    });
  }

  function openPanel(slot) {
    var panel = $('font-panel');
    if (!panel || typeof panel.showModal !== 'function') return;
    if (slot) state.slot = slot;
    if (!systemFonts.length) systemFonts = probeCommonFonts();
    setSlotButtons();
    updateSlotLabel();
    renderList();
    if (!panel.open) panel.showModal();
  }

  function initPanel() {
    var panel = $('font-panel');
    var opener = $('btn-font-panel');
    if (!panel || !opener || typeof panel.showModal !== 'function') return;

    opener.addEventListener('click', function () {
      openPanel(null);
    });

    Array.prototype.forEach.call(panel.querySelectorAll('[data-slot]'), function (button) {
      button.addEventListener('click', function () {
        state.slot = button.getAttribute('data-slot');
        setSlotButtons();
        updateSlotLabel();
        renderList();
      });
    });

    $('font-search').addEventListener('input', renderList);
    $('btn-detect').addEventListener('click', detectSystemFonts);
    $('btn-reveal').addEventListener('click', revealFontDir);

    $('btn-file').addEventListener('click', function () {
      $('file-input').click();
    });

    $('file-input').addEventListener('change', function (event) {
      loadFiles(event.target.files);
      event.target.value = '';
    });

    $('btn-reset').addEventListener('click', function () {
      state.latin = DEFAULTS.latin;
      state.cjk = DEFAULTS.cjk;
      state.unified = DEFAULTS.unified || '';
      state.compare = '';
      applyFonts();
      persist();
      renderList();
      status('已恢复 font.toml 中的字体设置');
    });

    // 拖放字体文件到页面任意位置
    ['dragenter', 'dragover'].forEach(function (type) {
      document.addEventListener(type, function (event) {
        if (!event.dataTransfer || Array.prototype.indexOf.call(event.dataTransfer.types, 'Files') === -1) return;
        event.preventDefault();
        document.body.classList.add('dropping');
      });
    });
    ['dragleave', 'dragend'].forEach(function (type) {
      document.addEventListener(type, function () {
        document.body.classList.remove('dropping');
      });
    });
    document.addEventListener('drop', function (event) {
      if (!event.dataTransfer) return;
      event.preventDefault();
      document.body.classList.remove('dropping');
      loadFiles(event.dataTransfer.files);
    });
  }

  /* ====================================================== 分屏对比 */

  /* 把正文复制一份（去掉 id，避免同一页面出现重复 id） */
  function cloneSheet() {
    var sheet = document.querySelector('main.sheet');
    if (!sheet) return null;
    var frag = document.createDocumentFragment();
    Array.prototype.forEach.call(sheet.childNodes, function (node) {
      frag.appendChild(node.cloneNode(true));
    });
    Array.prototype.forEach.call(frag.querySelectorAll('[id]'), function (el) {
      el.removeAttribute('id');
    });
    return frag;
  }

  function buildPanes() {
    var a = $('pane-body-a');
    var b = $('pane-body-b');
    if (!a || !b || a.childNodes.length) return;
    var first = cloneSheet();
    var second = cloneSheet();
    if (!first || !second) return;
    a.appendChild(first);
    b.appendChild(second);
  }

  function paneLabel(stack) {
    var names = splitFamilies(stack).filter(function (name) {
      return !isGeneric(name);
    });
    return names.slice(0, 3).join(' → ') || stack;
  }

  /* 每一侧只覆盖 --font-text / --font-head，其余变量继承根节点 */
  function refreshPaneFonts() {
    var paneA = $('pane-a');
    var paneB = $('pane-b');
    if (!paneA || !paneB) return;

    /* A 栏等于页面本身：正文跟当前字体栈，标题仍用 :root 的 --font-head，
       所以只覆盖 --font-text；B 栏连标题一起换成被对比的字体才比得全。 */
    paneA.style.setProperty('--font-text', textStack());
    paneB.style.setProperty('--font-text', compareStack());
    paneB.style.setProperty('--font-head', compareStack());

    var labelA = $('pane-font-a');
    var labelB = $('pane-font-b');
    if (labelA) {
      labelA.textContent = paneLabel(textStack());
      labelA.title = textStack();
    }
    if (labelB) {
      labelB.textContent = state.compare
        ? paneLabel(compareStack())
        : paneLabel(defaultStack()) + '（font.toml）';
      labelB.title = compareStack();
    }
  }

  /* 两侧行数不同，按滚动百分比同步。
     scroll 事件是异步的，程序写进去的位置会晚一拍回调过来；先用像素值
     记下“这一侧是我写的”，回响时直接吞掉，避免两边互相拉扯。 */
  function initCompareScroll() {
    var a = $('pane-body-a');
    var b = $('pane-body-b');
    if (!a || !b || a.getAttribute('data-synced') === 'true') return;
    a.setAttribute('data-synced', 'true');
    b.setAttribute('data-synced', 'true');

    var expected = new Map();

    function apply(from, to) {
      var maxFrom = from.scrollHeight - from.clientHeight;
      var maxTo = to.scrollHeight - to.clientHeight;
      if (maxFrom <= 0 || maxTo <= 0) return;
      var target = Math.round((from.scrollTop / maxFrom) * maxTo);
      if (Math.abs(to.scrollTop - target) <= 1) return; // 已经在同一比例上
      expected.set(to, target);
      to.scrollTop = target;
    }

    function watch(self, other) {
      self.addEventListener(
        'scroll',
        function () {
          var mine = expected.get(self);
          var isEcho = typeof mine === 'number' && Math.abs(self.scrollTop - mine) <= 1;
          expected.delete(self);
          if (isEcho) return;
          apply(self, other);
        },
        { passive: true }
      );
    }

    watch(a, b);
    watch(b, a);
  }

  function setCompare(on) {
    var section = $('compare');
    var button = $('btn-compare');
    if (!section || !button) return;
    if (on) {
      buildPanes();
      initCompareScroll();
    }
    document.body.classList.toggle('comparing', on);
    section.hidden = !on;
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? '退出对比' : '分屏对比';
    if (on) {
      refreshPaneFonts();
      syncTopbarHeight();
    }
  }

  function initCompare() {
    var button = $('btn-compare');
    if (!button) return;
    button.addEventListener('click', function () {
      setCompare(button.getAttribute('aria-pressed') !== 'true');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pane-pick'), function (pick) {
      pick.addEventListener('click', function () {
        openPanel(pick.getAttribute('data-slot'));
      });
    });
  }

  /* ====================================================== 页脚徽标 */

  function renderFooter() {
    var list = $('fontlist');
    if (!list) return;
    DEFAULTS.families.forEach(function (family) {
      var ok = probeFamily(family);
      var item = document.createElement('li');
      item.setAttribute('data-ok', ok ? 'true' : 'false');
      item.title = ok ? '本机可用' : '本机未安装，已回退到后继字体';
      var dot = document.createElement('span');
      dot.className = 'dot';
      item.appendChild(dot);
      item.appendChild(document.createTextNode(family));
      list.appendChild(item);
    });
  }

  /* ===================================================== 顶部粘性偏移 */

  /* 工具条会换行，高度不固定，量出来给字体信息条当 sticky top */
  function syncTopbarHeight() {
    var bar = document.querySelector('.topbar');
    if (bar) root.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
    var line = document.querySelector('.stackline');
    if (line) root.style.setProperty('--stackline-h', line.offsetHeight + 'px');
  }

  function initStickyStackline() {
    syncTopbarHeight();
    window.addEventListener('resize', syncTopbarHeight);
    window.addEventListener('orientationchange', syncTopbarHeight);
    var bar = document.querySelector('.topbar');
    if (bar && window.ResizeObserver) {
      new ResizeObserver(syncTopbarHeight).observe(bar);
    }
    var line = document.querySelector('.stackline');
    if (line && window.ResizeObserver) {
      new ResizeObserver(syncTopbarHeight).observe(line);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncTopbarHeight); // 字体落地后控件高度可能变
    }
  }

  /* ========================================================== 启动 */

  restore();
  initControls();
  applyFonts();
  initPanel();
  initCompare();
  initStickyStackline();
  detectServer();
  renderFooter();
})();
