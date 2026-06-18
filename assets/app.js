const TOKEN_KEY = "banya-auth-token";
const THEME_KEY = "banya-theme";
const FONTSIZE_KEY = "banya-fontsize";

let state = {
  user: null,
  provider: null,
  role: "parent",
  view: "dashboard",
  providers: [],
  requests: [],
  children: [],
  orders: [],
  messages: [],
  reviews: [],
  authMode: "login",
  selectedRequestId: null,
  apiOnline: true,
  loading: false,
  orderFilter: "all",
  providerFilter: "all",
  selectedThreadId: null
};

// 主题管理
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const isDark = current === "dark" ||
    (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  toast(next === "dark" ? "已切换到深色模式" : "已切换到浅色模式");
}

// 字号管理
const fontSizes = ["normal", "large"];
let fontSizeIndex = 0;

function initFontSize() {
  const saved = localStorage.getItem(FONTSIZE_KEY);
  if (saved === "large") {
    document.documentElement.setAttribute("data-fontsize", "large");
    fontSizeIndex = 1;
  }
}

function toggleFontSize() {
  fontSizeIndex = (fontSizeIndex + 1) % fontSizes.length;
  const size = fontSizes[fontSizeIndex];
  if (size === "normal") {
    document.documentElement.removeAttribute("data-fontsize");
    localStorage.removeItem(FONTSIZE_KEY);
  } else {
    document.documentElement.setAttribute("data-fontsize", size);
    localStorage.setItem(FONTSIZE_KEY, size);
  }
  toast(size === "large" ? "已切换到大字号" : "已切换到标准字号");
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function toast(message, type = "default") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast " + type;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function emptyState(title, text = "稍后再回来看看，或先完成上方操作。", action = "") {
  return `
    <div class="empty enhanced">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${action}
    </div>
  `;
}

function setButtonLoading(button, loading, text = "处理中") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.classList.add("is-loading");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-label", text);
  } else {
    button.classList.remove("is-loading");
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function clearFormErrors(form) {
  $all("[aria-invalid='true']", form).forEach(field => field.removeAttribute("aria-invalid"));
  $all(".input-error", form).forEach(error => error.remove());
}

function showFieldError(field, message) {
  field.setAttribute("aria-invalid", "true");
  const error = document.createElement("div");
  error.className = "input-error";
  error.textContent = message;
  field.closest(".field")?.appendChild(error);
}

function validateForm(form) {
  clearFormErrors(form);
  const invalid = $all("[required]", form).find(field => !String(field.value || "").trim());
  if (invalid) {
    showFieldError(invalid, "请先填写这个必填项");
    invalid.focus();
    toast("还有必填项未完成", "warning");
    return false;
  }
  const age = form.querySelector("input[name='age']");
  if (age && age.value) {
    const value = Number(age.value);
    const min = Number(age.min || 0);
    const max = Number(age.max || Infinity);
    if (value < min || value > max) {
      showFieldError(age, `年龄需在 ${min}-${max} 岁之间`);
      age.focus();
      toast("请检查年龄范围", "warning");
      return false;
    }
  }
  return true;
}

function animateNumber(el, nextValue) {
  const target = Number(nextValue) || 0;
  const previous = Number(el.dataset.value || el.textContent || 0);
  el.dataset.value = String(target);
  if (previous === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = target;
    return;
  }
  const start = performance.now();
  const duration = 520;
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(previous + (target - previous) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const commandItems = [
  { id: "dashboard", title: "回到首页", desc: "查看数据、孩子档案和发布需求", keywords: "首页 dashboard home", run: () => switchViewAndRender("dashboard") },
  { id: "requests", title: "打开需求广场", desc: "查看待匹配需求和推荐陪伴者", keywords: "需求 广场 requests", run: () => switchViewAndRender("requests") },
  { id: "providers", title: "查看陪伴者", desc: "浏览认证陪伴者和服务能力", keywords: "陪伴者 provider 老师", run: () => switchViewAndRender("providers") },
  { id: "orders", title: "查看我的订单", desc: "管理接单、陪伴中和已完成订单", keywords: "订单 orders", run: () => switchViewAndRender("orders") },
  { id: "messages", title: "打开消息", desc: "查看订单沟通消息", keywords: "消息 chat message", run: () => switchViewAndRender("messages") },
  { id: "profile", title: "个人中心", desc: "管理账号信息和偏好设置", keywords: "个人 中心 profile 设置 账号", run: () => switchViewAndRender("profile") },
  { id: "help", title: "帮助中心", desc: "查看使用指南和常见问题", keywords: "帮助 help faq 指南 问题", run: () => switchViewAndRender("help") },
  { id: "publish", title: "发布陪伴需求", desc: "跳到首页的需求发布表单", keywords: "发布 需求 create", run: () => handleAction({ dataset: { action: "scroll-create" } }) },
  { id: "theme", title: "切换深浅色主题", desc: "在浅色和深色模式之间切换", keywords: "主题 深色 浅色 dark light", run: toggleTheme },
  { id: "font", title: "切换字号大小", desc: "标准字号和大字号之间切换", keywords: "字号 大字 font", run: toggleFontSize }
];

let activeCommandIndex = 0;

function switchViewAndRender(view) {
  switchView(view);
  render();
}

function filteredCommands() {
  const keyword = ($("#commandInput")?.value || "").trim().toLowerCase();
  if (!keyword) return commandItems;
  return commandItems.filter(item =>
    `${item.title} ${item.desc} ${item.keywords}`.toLowerCase().includes(keyword)
  );
}

function renderCommandList() {
  const list = $("#commandList");
  if (!list) return;
  const items = filteredCommands();
  if (!items.length) {
    list.innerHTML = emptyState("没有匹配的操作", "换个关键词试试，例如“订单”“主题”或“发布”。");
    return;
  }
  activeCommandIndex = Math.min(activeCommandIndex, items.length - 1);
  list.innerHTML = items.map((item, index) => `
    <button class="command-item ${index === activeCommandIndex ? "active" : ""}" role="option" data-command="${escapeHtml(item.id)}" aria-selected="${index === activeCommandIndex}">
      <span class="command-icon">${index + 1}</span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.desc)}</small>
      </span>
    </button>
  `).join("");
}

function openCommandPalette() {
  const palette = $("#commandPalette");
  if (!palette) return;
  palette.classList.add("show");
  palette.setAttribute("aria-hidden", "false");
  activeCommandIndex = 0;
  $("#commandInput").value = "";
  renderCommandList();
  window.setTimeout(() => $("#commandInput")?.focus(), 40);
}

function closeCommandPalette() {
  const palette = $("#commandPalette");
  if (!palette) return;
  palette.classList.remove("show");
  palette.setAttribute("aria-hidden", "true");
}

function runActiveCommand(commandId) {
  const items = filteredCommands();
  const command = commandId
    ? commandItems.find(item => item.id === commandId)
    : items[activeCommandIndex];
  if (!command) return;
  closeCommandPalette();
  command.run();
  toast(`已执行：${command.title}`, "success");
}

// 切换视图时加上退场动画
function switchView(viewName) {
  const current = $(".view.active");
  const next = $(`#${viewName}View`);
  if (!next || current === next) return;
  if (current) {
    current.classList.add("leaving");
    window.setTimeout(() => {
      current.classList.remove("active", "leaving");
      next.classList.add("active");
    }, 180);
  } else {
    next.classList.add("active");
  }
  state.view = viewName;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function statusLabel(status) {
  return {
    open: "待匹配",
    accepted: "已接单",
    arrived: "陪伴中",
    done: "已完成"
  }[status] || status;
}

async function loadBootstrap() {
  try {
    const data = await api("/api/bootstrap");
    state.apiOnline = true;
    state.user = data.user || null;
    state.provider = data.provider || null;
    state.providers = data.providers || [];
    state.requests = data.requests || [];
    state.children = data.children || [];
    state.orders = data.orders || [];
    state.messages = data.messages || [];
    state.reviews = data.reviews || [];
    if (state.user) state.role = state.user.role;
  } catch {
    state.apiOnline = false;
  }
}

async function refresh() {
  await loadBootstrap();
  render();
}

function requireLoginText() {
  return emptyState("请先登录或注册", "登录后即可发布需求、接单、管理订单和发送消息。");
}

function renderStats() {
  animateNumber($("#statRequests"), state.requests.length);
  animateNumber($("#statProviders"), state.providers.filter(p => p.verified).length);
  animateNumber($("#statOrders"), state.orders.filter(order => order.status !== "done").length);
  animateNumber($("#statMessages"), state.messages.length);
  $("#todayText").textContent = new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const latest = state.requests.find(item => item.status === "open");
  $("#phoneRecommend").textContent = latest
    ? `最新需求：${latest.area}，${latest.time}，需要${latest.service}。`
    : "暂无待匹配需求，可以先发布一个陪伴需求。";

  // 趋势分析：按天聚合最近 7 天数据
  renderTrends();
}

function renderTrends() {
  const days = 7;
  const today = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({ date: d, count: 0, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }

  // 统计每天的事件数（需求+订单+消息）
  const allEvents = [
    ...state.requests.map(r => r.createdAt),
    ...state.orders.map(o => o.createdAt),
    ...state.messages.map(m => m.createdAt)
  ];
  allEvents.forEach(ts => {
    if (!ts) return;
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => b.date.getTime() === d.getTime());
    if (bucket) bucket.count++;
  });

  // 如果没有数据，生成模拟趋势
  const hasData = buckets.some(b => b.count > 0);
  if (!hasData) {
    buckets.forEach((b, i) => { b.count = [2, 5, 3, 8, 6, 10, 7][i] || 3; b.mock = true; });
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const recent = buckets.slice(-3).reduce((sum, b) => sum + b.count, 0);
  const earlier = buckets.slice(0, 4).reduce((sum, b) => sum + b.count, 0);
  const trendDir = recent > earlier ? "up" : recent < earlier ? "down" : "flat";
  const trendPct = earlier > 0 ? Math.round(((recent - earlier) / earlier) * 100) : 0;

  // 为每个统计卡片渲染迷你柱状图
  const trendConfigs = [
    { id: "trendRequests", data: buckets, color: "brand" },
    { id: "trendProviders", data: buckets.map(b => ({ ...b, count: Math.round(b.count * 0.3 + (hasData ? 0 : 1)) })), color: "brand-2" },
    { id: "trendOrders", data: buckets.map(b => ({ ...b, count: Math.round(b.count * 0.5) })), color: "brand" },
    { id: "trendMessages", data: buckets, color: "brand-2" }
  ];

  trendConfigs.forEach(cfg => {
    const el = $(`#${cfg.id}`);
    if (!el) return;
    const localMax = Math.max(...cfg.data.map(b => b.count), 1);
    el.innerHTML = `
      <div class="sparkline" aria-hidden="true">
        ${cfg.data.map(b => {
          const h = Math.max(8, Math.round((b.count / localMax) * 100));
          return `<span class="spark-bar ${cfg.color}" style="height:${h}%" title="${b.label}: ${b.count}"></span>`;
        }).join("")}
      </div>
      <div class="trend-label ${trendDir}">
        ${trendDir === "up" ? "↗" : trendDir === "down" ? "↘" : "→"} ${Math.abs(trendPct)}%
      </div>
    `;
  });
}

function renderChildrenPanel() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>孩子档案</h2>
          <p>先建立孩子档案，后续需求、陪伴记录和成长反馈都可以围绕孩子沉淀。</p>
        </div>
      </div>
      <form id="childForm" class="form-grid">
        <div class="field"><label>孩子昵称</label><input name="name" placeholder="例如：小雨" required></div>
        <div class="field"><label>年龄</label><input name="age" type="number" min="3" max="14" required></div>
        <div class="field"><label>性别</label><input name="gender" placeholder="可不填"></div>
        <div class="field"><label>兴趣标签</label><input name="interests" placeholder="阅读，画画，足球"></div>
        <div class="field full"><label>注意事项</label><textarea name="notes" placeholder="性格、过敏、作息、情绪特点等"></textarea></div>
        <div class="field full"><button class="primary-btn" type="submit">保存孩子档案</button></div>
      </form>
      <div class="divider"></div>
      ${state.children.length ? `<div class="grid cols-3">
        ${state.children.map(child => `
          <article class="item-card">
            <h3>${escapeHtml(child.name)} · ${escapeHtml(child.age)}岁</h3>
            <p class="muted">${escapeHtml(child.gender || "未填写性别")}</p>
            ${tagRow(child.interests)}
            <p>${escapeHtml(child.notes || "暂无注意事项")}</p>
          </article>
        `).join("")}
      </div>` : emptyState("还没有孩子档案", "先保存一个孩子档案，后续需求和成长记录都会围绕孩子沉淀。")}
    </section>
  `;
}

function renderAuth() {
  const root = $("#authPanel");
  const isLoggedIn = Boolean(state.user);
  if (!state.apiOnline) {
    root.classList.add("active");
    root.innerHTML = `
      <div class="auth-card">
        <div class="auth-intro">
          <h2>需要启动后端服务</h2>
          <p>现在打开的是静态文件，注册登录和数据库功能需要通过 Node.js 服务运行。</p>
        </div>
        <div>
          <h3>启动方式</h3>
          <p class="muted">在项目目录运行：</p>
          <div class="mini-card"><strong>npm start</strong><p>然后访问 http://localhost:3000</p></div>
        </div>
      </div>
    `;
    return;
  }
  if (isLoggedIn) {
    root.classList.remove("active");
    root.innerHTML = "";
    $("#accountBtn").textContent = `${state.user.name} · 退出`;
    return;
  }
  $("#accountBtn").textContent = "登录/注册";
  root.classList.add("active");
  root.innerHTML = `
    <div class="auth-card">
      <div class="auth-intro">
        <span class="auth-badge">伴芽 BANYA</span>
        <h2>登录后开始匹配陪伴服务</h2>
        <p>家长像发布职位一样发布陪伴需求，陪伴者像找兼职一样查看并接单。平台会沉淀孩子档案、陪伴记录、评价和认证信息。</p>
        <div class="auth-demo">
          <strong>试用账号</strong>
          <p>家长：13800000000 / 123456</p>
          <p>陪伴者：13900000000 / 123456</p>
        </div>
      </div>
      <div class="auth-form-card">
        <h3>${state.authMode === "login" ? "欢迎回来" : "创建伴芽账号"}</h3>
        <p class="muted">${state.authMode === "login" ? "登录后查看需求、订单和消息。" : "选择家长或陪伴者身份，进入对应工作台。"}</p>
        <div class="auth-tabs">
          <button class="auth-tab ${state.authMode === "login" ? "active" : ""}" data-auth-mode="login">登录</button>
          <button class="auth-tab ${state.authMode === "register" ? "active" : ""}" data-auth-mode="register">注册</button>
        </div>
        ${state.authMode === "login" ? renderLoginForm() : renderRegisterForm()}
      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <form id="loginForm" class="form-grid">
      <div class="field">
        <label>手机号</label>
        <input name="phone" value="13800000000" required>
      </div>
      <div class="field">
        <label>密码</label>
        <input name="password" type="password" value="123456" required>
      </div>
      <div class="field full">
        <button class="primary-btn" type="submit">登录伴芽</button>
      </div>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="registerForm" class="form-grid">
      <div class="field">
        <label>姓名/昵称</label>
        <input name="name" placeholder="例如：李女士 / 林老师" required>
      </div>
      <div class="field">
        <label>手机号</label>
        <input name="phone" placeholder="请输入手机号" required>
      </div>
      <div class="field">
        <label>密码</label>
        <input name="password" type="password" placeholder="至少6位" required>
      </div>
      <div class="field">
        <label>身份</label>
        <select name="role">
          <option value="parent">家长</option>
          <option value="provider">陪伴者</option>
        </select>
      </div>
      <div class="field full">
        <label>所在小区/区域</label>
        <input name="area" placeholder="例如：绿芽小区">
      </div>
      <div class="field full">
        <button class="primary-btn" type="submit">注册并进入</button>
      </div>
    </form>
  `;
}

function tagRow(tags) {
  return `<div class="tag-row">${(tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function distanceValue(distance) {
  const value = Number(String(distance || "").match(/[\d.]+/)?.[0] || 99);
  return Number.isFinite(value) ? value : 99;
}

function providerMatchSummary(request, provider) {
  const serviceText = `${request.service || ""} ${request.note || ""}`;
  const matchedSkills = (provider.skills || []).filter(skill => serviceText.includes(skill) || serviceText.includes(skill.slice(0, 2)));
  const budget = Number(request.budget || 0);
  const price = Number(provider.price || 0);
  const distance = distanceValue(provider.distance);
  const rating = Number(provider.rating || 0);
  const reasons = [];
  let score = 48;

  if (matchedSkills.length) {
    score += Math.min(24, matchedSkills.length * 9);
    reasons.push(`技能匹配：${matchedSkills.slice(0, 2).join("、")}`);
  } else if ((provider.skills || []).length) {
    score += 6;
    reasons.push(`可覆盖：${provider.skills.slice(0, 2).join("、")}`);
  }

  if (provider.verified) {
    score += 12;
    reasons.push("已完成认证");
  }

  if (rating >= 4.8) {
    score += 8;
    reasons.push("评分稳定");
  } else if (rating >= 4.5) {
    score += 5;
    reasons.push("评价较好");
  }

  if (budget && price) {
    const gap = price - budget;
    if (gap <= 0) {
      score += 8;
      reasons.push("价格在预算内");
    } else if (gap <= 20) {
      score += 4;
      reasons.push("价格接近预算");
    } else {
      score -= 8;
      reasons.push("价格高于预算");
    }
  }

  if (distance <= 1) {
    score += 8;
    reasons.push("距离很近");
  } else if (distance <= 2) {
    score += 5;
    reasons.push("距离适中");
  }

  score = Math.max(35, Math.min(98, score));
  const label = score >= 88 ? "强推荐" : score >= 74 ? "较匹配" : "可沟通";
  return {
    score,
    label,
    reasons: reasons.slice(0, 4),
    matchedSkills
  };
}

function bestProvidersFor(request) {
  return state.providers
    .map(provider => {
      const match = providerMatchSummary(request, provider);
      return { ...provider, match, score: match.score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function relativeTime(value) {
  const time = new Date(value || Date.now()).getTime();
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(time).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function businessMetrics() {
  const activeOrders = state.orders.filter(order => order.status === "accepted" || order.status === "arrived").length;
  const finishedOrders = state.orders.filter(order => order.status === "done").length;
  const reviewedOrders = state.orders.filter(order => order.review).length;
  const avgRating = state.reviews.length
    ? (state.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / state.reviews.length).toFixed(1)
    : "暂无";
  const verifiedProviders = state.providers.filter(provider => provider.verified).length;
  const verifyRate = state.providers.length ? Math.round((verifiedProviders / state.providers.length) * 100) : 0;
  const completionRate = state.orders.length ? Math.round((finishedOrders / state.orders.length) * 100) : 0;
  const responseRate = state.orders.length ? Math.round((state.messages.length / Math.max(state.orders.length, 1)) * 100) : 0;
  return { activeOrders, finishedOrders, reviewedOrders, avgRating, verifiedProviders, verifyRate, completionRate, responseRate };
}

function renderQualityPanel() {
  const metrics = businessMetrics();
  const cards = [
    { label: "进行中订单", value: metrics.activeOrders, hint: "需要持续跟进", cls: "brand" },
    { label: "完成率", value: `${metrics.completionRate}%`, hint: `${metrics.finishedOrders} 单已完成`, cls: "success" },
    { label: "陪伴者认证", value: `${metrics.verifyRate}%`, hint: `${metrics.verifiedProviders}/${state.providers.length || 0} 已认证`, cls: "warning" },
    { label: "平均评分", value: metrics.avgRating, hint: `${metrics.reviewedOrders} 单已有评价`, cls: "rating" }
  ];
  return `
    <section class="panel quality-panel">
      <div class="panel-head">
        <div>
          <h2>服务质量概览</h2>
          <p>用几个关键指标快速判断当前平台运行状态。</p>
        </div>
        <button class="ghost-btn" data-view="orders">查看订单</button>
      </div>
      <div class="quality-grid">
        ${cards.map(card => `
          <article class="quality-card ${card.cls}">
            <span>${card.label}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <small>${escapeHtml(card.hint)}</small>
          </article>
        `).join("")}
      </div>
      <div class="quality-meter" aria-label="订单完成率 ${metrics.completionRate}%">
        <span style="width:${metrics.completionRate}%"></span>
      </div>
      <p class="muted quality-note">绿色进度表示订单完成比例，结合认证率和评分可帮助判断服务稳定性。</p>
    </section>
  `;
}

function recentActivities() {
  const requestEvents = state.requests.map(request => ({
    type: "request",
    title: `${request.childName} 的${request.service}`,
    text: `${statusLabel(request.status)} · ${request.area} · ${request.budget}元/时`,
    time: request.createdAt,
    icon: "需"
  }));
  const orderEvents = state.orders.map(order => ({
    type: "order",
    title: `${order.childName} · ${order.service}`,
    text: `${statusLabel(order.status)} · 陪伴者 ${order.providerName}`,
    time: order.createdAt,
    icon: "单"
  }));
  const messageEvents = state.messages.map(message => ({
    type: "message",
    title: message.senderRole === "parent" ? "家长发送了消息" : message.senderRole === "provider" ? "陪伴者发送了消息" : "系统通知",
    text: message.text,
    time: message.createdAt,
    icon: "信"
  }));
  const reviewEvents = state.reviews.map(review => ({
    type: "review",
    title: `收到 ${review.rating || 0} 星评价`,
    text: review.text || "家长未填写文字评价",
    time: review.createdAt,
    icon: "评"
  }));
  return [...requestEvents, ...orderEvents, ...messageEvents, ...reviewEvents]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 6);
}

function renderActivityPanel() {
  const items = recentActivities();
  return `
    <section class="panel activity-panel">
      <div class="panel-head">
        <div>
          <h2>近期动态</h2>
          <p>把需求、订单、消息和评价串成一条时间线，方便快速回看。</p>
        </div>
        <button class="ghost-btn" data-view="messages">查看消息</button>
      </div>
      ${items.length ? `
        <div class="activity-timeline">
          ${items.map(item => `
            <article class="activity-item ${item.type}">
              <span class="activity-icon">${escapeHtml(item.icon)}</span>
              <div>
                <div class="activity-title">
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${relativeTime(item.time)}</small>
                </div>
                <p>${escapeHtml(item.text)}</p>
              </div>
            </article>
          `).join("")}
        </div>
      ` : emptyState("暂无近期动态", "发布需求、生成订单或发送消息后，这里会自动出现时间线。")}
    </section>
  `;
}

function safetyChecklist() {
  const hasChild = state.children.length > 0;
  const hasOpenRequest = state.requests.some(request => request.status === "open");
  const hasOrder = state.orders.length > 0;
  const hasMessages = state.messages.length > 0;
  const hasReport = state.orders.some(order => order.report?.activities);
  const providerVerified = Boolean(state.provider?.verified);
  if (state.user?.role === "provider") {
    return [
      { title: "主页资料完整", text: "服务距离、时薪、技能标签和简介会影响家长选择。", done: Boolean(state.provider?.bio && state.provider?.skills?.length) },
      { title: "认证状态明确", text: "认证后会在列表和订单流程中展示可信状态。", done: providerVerified },
      { title: "接单前沟通", text: "确认地点、接送规则、孩子性格和紧急联系人。", done: hasMessages },
      { title: "陪伴后留痕", text: "完成订单后填写活动、情绪、作业和建议，便于家长复盘。", done: hasReport }
    ];
  }
  return [
    { title: "孩子档案已建立", text: "记录年龄、兴趣、注意事项，方便陪伴者提前了解孩子。", done: hasChild },
    { title: "需求说明清晰", text: "地点、时间、预算、服务类型和补充说明越完整，匹配越准确。", done: hasOpenRequest || hasOrder },
    { title: "选择认证陪伴者", text: "优先选择已认证、评分稳定、技能匹配的陪伴者。", done: state.orders.some(order => state.providers.find(provider => provider.id === order.providerId)?.verified) },
    { title: "订单内沟通留痕", text: "关键约定建议通过消息页确认，方便后续追踪。", done: hasMessages }
  ];
}

function renderSafetyPanel() {
  const items = safetyChecklist();
  const doneCount = items.filter(item => item.done).length;
  const score = Math.round((doneCount / items.length) * 100);
  return `
    <section class="panel safety-panel">
      <div class="panel-head">
        <div>
          <h2>安全陪伴清单</h2>
          <p>把服务前、中、后的关键保障显性化，降低沟通遗漏。</p>
        </div>
        <span class="safety-score">${score}% 完成</span>
      </div>
      <div class="safety-progress" aria-label="安全清单完成度 ${score}%"><span style="width:${score}%"></span></div>
      <div class="safety-list">
        ${items.map(item => `
          <article class="safety-item ${item.done ? "done" : ""}">
            <span class="safety-check">${item.done ? "✓" : "!"}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.text)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function childGrowthSummaries() {
  return state.children.map(child => {
    const orders = state.orders.filter(order => order.childName === child.name);
    const reports = orders.filter(order => order.report?.activities);
    const reviews = orders.filter(order => order.review);
    const latestReport = reports[reports.length - 1]?.report;
    const serviceTypes = [...new Set(orders.map(order => order.service).filter(Boolean))].slice(0, 3);
    return {
      child,
      orders,
      reports,
      reviews,
      latestReport,
      serviceTypes
    };
  });
}

function renderGrowthPanel() {
  if (state.user?.role !== "parent") return "";
  const summaries = childGrowthSummaries();
  return `
    <section class="panel growth-panel">
      <div class="panel-head">
        <div>
          <h2>孩子成长摘要</h2>
          <p>把陪伴记录、服务类型和评价沉淀成可回看的成长线索。</p>
        </div>
        <button class="ghost-btn" data-view="orders">查看陪伴记录</button>
      </div>
      ${summaries.length ? `
        <div class="growth-grid">
          ${summaries.map(item => `
            <article class="growth-card">
              <div class="growth-head">
                ${avatarFor(item.child.name)}
                <div>
                  <h3>${escapeHtml(item.child.name)} · ${escapeHtml(item.child.age)}岁</h3>
                  <p class="muted">${escapeHtml((item.child.interests || []).join("、") || "暂无兴趣标签")}</p>
                </div>
              </div>
              <div class="growth-stats">
                <span><strong>${item.orders.length}</strong> 次陪伴</span>
                <span><strong>${item.reports.length}</strong> 份记录</span>
                <span><strong>${item.reviews.length}</strong> 条评价</span>
              </div>
              ${item.serviceTypes.length ? tagRow(item.serviceTypes) : `<p class="muted">暂无服务类型沉淀</p>`}
              <div class="growth-note">
                <strong>最近观察</strong>
                <p>${escapeHtml(item.latestReport?.suggestion || item.latestReport?.mood || item.child.notes || "完成一次订单并保存陪伴记录后，这里会展示最近观察。")}</p>
              </div>
            </article>
          `).join("")}
        </div>
      ` : emptyState("还没有成长摘要", "先保存孩子档案，后续陪伴记录会在这里汇总。")}
    </section>
  `;
}

// 通知中心和新手引导逻辑
function getNotifications() {
  const notifications = [];
  if (!state.user) return notifications;

  if (state.user.role === "parent") {
    if (state.children.length === 0) {
      notifications.push({ type: "guide", icon: "👶", title: "建立孩子档案", text: "先添加孩子信息，以便更好地匹配陪伴者。", view: "dashboard" });
    }
    const openRequests = state.requests.filter(r => r.status === "open");
    if (openRequests.length > 0) {
      notifications.push({ type: "info", icon: "🔔", title: `有 ${openRequests.length} 个待匹配需求`, text: "去查看推荐陪伴者并下单。", view: "requests" });
    }
    const needReview = state.orders.filter(o => o.status === "done" && !o.review);
    if (needReview.length > 0) {
      notifications.push({ type: "action", icon: "⭐", title: `${needReview.length} 个订单待评价`, text: "完成评价可以帮助其他家长选择。", view: "orders" });
    }
    const activeOrders = state.orders.filter(o => o.status === "accepted" || o.status === "arrived");
    if (activeOrders.length > 0) {
      notifications.push({ type: "action", icon: "📍", title: `${activeOrders.length} 个订单进行中`, text: "可以查看陪伴进度或更新状态。", view: "orders" });
    }
  } else {
    if (!state.provider?.verified) {
      notifications.push({ type: "guide", icon: "🛡️", title: "完成认证", text: "完成认证可以增加家长的信任度。", view: "dashboard" });
    }
    if (!state.provider?.bio || !state.provider?.skills?.length) {
      notifications.push({ type: "guide", icon: "📝", title: "完善主页资料", text: "填写简介和技能标签，让家长更容易找到你。", view: "dashboard" });
    }
    const openRequests = state.requests.filter(r => r.status === "open");
    if (openRequests.length > 0) {
      notifications.push({ type: "info", icon: "🔔", title: `${openRequests.length} 个可接需求`, text: "去接单大厅查看附近家庭需求。", view: "requests" });
    }
    const activeOrders = state.orders.filter(o => o.status === "accepted" || o.status === "arrived");
    if (activeOrders.length > 0) {
      notifications.push({ type: "action", icon: "📍", title: `${activeOrders.length} 个订单进行中`, text: "记得更新陪伴状态和填写记录。", view: "orders" });
    }
  }

  const unreadMessages = state.messages.filter(m => m.senderRole !== state.user.role && m.senderRole !== "system");
  if (unreadMessages.length > 0) {
    notifications.push({ type: "message", icon: "💬", title: `${unreadMessages.length} 条未读消息`, text: "去消息页查看对方发来的沟通内容。", view: "messages" });
  }

  return notifications;
}

function renderNotificationCenter() {
  const notifications = getNotifications();
  if (!notifications.length) return "";
  return `
    <section class="panel notification-center">
      <div class="panel-head">
        <div>
          <h2>通知与待办</h2>
          <p>这里是你需要关注的重要信息和操作引导。</p>
        </div>
        <span class="notify-count">${notifications.length}</span>
      </div>
      <div class="notification-list">
        ${notifications.map(n => `
          <article class="notification-item ${n.type}">
            <span class="notification-icon">${n.icon}</span>
            <div class="notification-content">
              <strong>${escapeHtml(n.title)}</strong>
              <p>${escapeHtml(n.text)}</p>
            </div>
            ${n.view ? `<button class="ghost-btn" data-view="${escapeHtml(n.view)}">去处理</button>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

// 更新 topbar 铃铛徽标
function updateNotifyBadge() {
  const badge = $("#notifyBadge");
  const notifications = getNotifications();
  if (!badge) return;
  if (notifications.length > 0) {
    badge.textContent = notifications.length > 9 ? "9+" : String(notifications.length);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

// 渲染 topbar 下拉通知面板
function renderNotifyPanel() {
  const panel = $("#notifyPanel");
  if (!panel) return;
  const notifications = getNotifications();
  if (!notifications.length) {
    panel.innerHTML = `<div class="notify-empty"><p>🎉 暂无待办，一切就绪</p></div>`;
    return;
  }
  panel.innerHTML = `
    <div class="notify-panel-head">
      <strong>通知与待办</strong>
      <small>${notifications.length} 条</small>
    </div>
    <div class="notify-panel-list">
      ${notifications.map(n => `
        <button class="notify-panel-item ${n.type}" data-view="${escapeHtml(n.view || "dashboard")}">
          <span class="notification-icon">${n.icon}</span>
          <div>
            <strong>${escapeHtml(n.title)}</strong>
            <p>${escapeHtml(n.text)}</p>
          </div>
        </button>
      `).join("")}
    </div>
  `;
}

// 新手引导横幅
function renderOnboardingBanner() {
  if (!state.user) return "";
  const key = `banya-onboarding-${state.user.id}`;
  if (localStorage.getItem(key)) return "";
  const steps = state.user.role === "parent" ? [
    { num: 1, title: "建立孩子档案", text: "记录年龄、兴趣和注意事项" },
    { num: 2, title: "发布陪伴需求", text: "描述时间、地点和服务类型" },
    { num: 3, title: "选择推荐陪伴者", text: "查看匹配分并下单" },
    { num: 4, title: "沟通与评价", text: "订单内沟通，完成后评价" }
  ] : [
    { num: 1, title: "完善主页资料", text: "填写简介、技能和时薪" },
    { num: 2, title: "完成认证", text: "提升可信度" },
    { num: 3, title: "浏览接单大厅", text: "查看附近需求并接单" },
    { num: 4, title: "陪伴与记录", text: "更新状态，填写陪伴记录" }
  ];
  return `
    <section class="panel onboarding-banner">
      <div class="onboarding-head">
        <div>
          <h2>👋 欢迎使用伴芽</h2>
          <p>按以下步骤快速开始${state.user.role === "parent" ? "为孩子找到陪伴者" : "接单陪伴"}。</p>
        </div>
        <button class="ghost-btn" data-action="dismiss-onboarding">我知道了</button>
      </div>
      <div class="onboarding-steps">
        ${steps.map(step => `
          <div class="onboarding-step">
            <span class="onboarding-num">${step.num}</span>
            <div>
              <strong>${escapeHtml(step.title)}</strong>
              <p class="muted">${escapeHtml(step.text)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDashboard() {
  const root = $("#dashboardView");
  if (!state.user) {
    root.innerHTML = `<section class="panel">${requireLoginText()}</section>`;
    return;
  }
  if (state.user.role === "parent") {
    const openRequests = state.requests.filter(item => item.status === "open");
    root.innerHTML = `
      ${renderOnboardingBanner()}
      ${renderNotificationCenter()}
      ${renderQualityPanel()}
      ${renderActivityPanel()}
      ${renderSafetyPanel()}
      ${renderGrowthPanel()}
      ${renderChildrenPanel()}
      <section class="panel" id="createRequestPanel">
        <div class="panel-head">
          <div>
            <h2>发布陪伴需求</h2>
            <p>发布后会进入需求广场，家长可以选择推荐陪伴者下单。</p>
          </div>
          <button class="ghost-btn" data-action="fill-demo-request">填入示例</button>
        </div>
        <form id="requestForm" class="form-grid">
          <div class="field">
            <label>孩子昵称</label>
            <input name="childName" list="childNameList" required>
            <datalist id="childNameList">
              ${state.children.map(child => `<option value="${escapeHtml(child.name)}"></option>`).join("")}
            </datalist>
          </div>
          <div class="field"><label>孩子年龄</label><input name="age" type="number" min="3" max="14" required></div>
          <div class="field"><label>服务地点</label><input name="area" value="${escapeHtml(state.user.area || "")}" required></div>
          <div class="field"><label>服务日期</label><input name="date" placeholder="今天 / 周五 / 2026-06-20" required></div>
          <div class="field"><label>服务时间</label><input name="time" placeholder="15:40-18:30" required></div>
          <div class="field">
            <label>陪伴类型</label>
            <select name="service">
              <option>放学接送 + 阅读陪伴</option>
              <option>作业引导 + 情绪陪聊</option>
              <option>户外运动 + 儿童社交</option>
              <option>周末兴趣陪伴</option>
              <option>临时紧急托底</option>
            </select>
          </div>
          <div class="field"><label>预算/小时</label><input name="budget" type="number" min="1" value="80" required></div>
          <div class="field full"><label>补充说明</label><textarea name="note" required></textarea></div>
          <div class="field full"><button class="primary-btn" type="submit">发布需求</button></div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>待匹配需求</h2><p>选择推荐陪伴者并生成订单。</p></div></div>
        ${openRequests.length ? renderRequestBoard(openRequests, "parent") : emptyState("暂无待匹配需求", "可以先发布一个陪伴需求，系统会在需求广场中展示。")}
      </section>
    `;
  } else {
    root.innerHTML = `
      ${renderOnboardingBanner()}
      ${renderNotificationCenter()}
      ${renderQualityPanel()}
      ${renderActivityPanel()}
      ${renderSafetyPanel()}
      <section class="panel">
        <div class="panel-head">
          <div><h2>陪伴者主页</h2><p>完善资料后，家长更容易选择你。</p></div>
          <span class="status ${state.provider?.verified ? "open" : "matched"}">${state.provider?.verified ? "已认证" : state.provider?.verificationStatus === "pending" ? "认证审核中" : "待认证"}</span>
        </div>
        <form id="providerForm" class="form-grid">
          <div class="field"><label>姓名/昵称</label><input name="name" value="${escapeHtml(state.provider?.name || state.user.name)}" required></div>
          <div class="field"><label>身份类型</label><input name="type" value="${escapeHtml(state.provider?.type || "师范生")}" required></div>
          <div class="field"><label>服务距离</label><input name="distance" value="${escapeHtml(state.provider?.distance || "1.0km")}" required></div>
          <div class="field"><label>期望时薪</label><input name="price" type="number" value="${escapeHtml(state.provider?.price || 78)}" required></div>
          <div class="field full"><label>技能标签，用逗号分隔</label><input name="skills" value="${escapeHtml((state.provider?.skills || ["阅读陪伴", "作业引导"]).join("，"))}" required></div>
          <div class="field full"><label>个人简介</label><textarea name="bio" required>${escapeHtml(state.provider?.bio || "热爱儿童教育，下午和周末可接单。")}</textarea></div>
          <div class="field full">
            <button class="primary-btn" type="submit">保存主页</button>
            <button class="ghost-btn" type="button" data-action="verify-provider">模拟完成认证</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div><h2>认证申请</h2><p>真实上线时这里会接入实名、人脸、无犯罪记录和资质材料审核。当前先做流程闭环。</p></div>
        </div>
        <form id="verificationForm" class="form-grid">
          <div class="field"><label>真实姓名</label><input name="realName" value="${escapeHtml(state.provider?.name || state.user.name)}" required></div>
          <div class="field"><label>资质类型</label><input name="credentialType" placeholder="教师资格证 / 学生证 / 培训证明" required></div>
          <div class="field"><label>证件编号</label><input name="credentialNo" placeholder="仅演示，会自动脱敏" required></div>
          <div class="field full"><label>陪伴/教育经历</label><textarea name="experience" required></textarea></div>
          <div class="field full"><button class="primary-btn" type="submit">提交认证申请</button></div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>附近可接需求</h2><p>选择需求后可直接接单。</p></div></div>
        ${renderRequestBoard(state.requests.filter(item => item.status === "open"), "provider")}
      </section>
    `;
  }
}

function renderRequestGrid(requests, withRecommendations) {
  if (!requests.length) return emptyState("暂无需求", "换个筛选条件试试，或稍后再查看新的陪伴需求。");
  return `<div class="grid cols-2">${requests.map(request => renderRequestCard(request, withRecommendations)).join("")}</div>`;
}

function requestMeta(request) {
  return `${escapeHtml(request.area)}｜${escapeHtml(request.date)} ${escapeHtml(request.time)}`;
}

function selectRequest(requests) {
  if (!requests.length) return null;
  const selected = requests.find(request => request.id === state.selectedRequestId);
  return selected || requests[0];
}

function renderRequestBoard(requests, mode) {
  const selected = selectRequest(requests);
  if (!requests.length) return emptyState("暂无需求", "当前筛选条件下没有可展示的陪伴需求。");
  return `
    <div class="boss-board">
      <aside class="boss-sidebar">
        <div class="sidebar-group">
          <div class="sidebar-title">服务类型</div>
          <button class="sidebar-item active" data-action="filter-service" data-value="">全部</button>
          <button class="sidebar-item" data-action="filter-service" data-value="放学接送">放学接送</button>
          <button class="sidebar-item" data-action="filter-service" data-value="作业引导">作业引导</button>
          <button class="sidebar-item" data-action="filter-service" data-value="户外运动">户外运动</button>
          <button class="sidebar-item" data-action="filter-service" data-value="周末兴趣">周末兴趣</button>
          <button class="sidebar-item" data-action="filter-service" data-value="临时紧急">临时紧急</button>
        </div>
        <div class="sidebar-group">
          <div class="sidebar-title">预算范围</div>
          <button class="sidebar-item active" data-action="filter-budget" data-value="">不限</button>
          <button class="sidebar-item" data-action="filter-budget" data-value="0-80">80元以下</button>
          <button class="sidebar-item" data-action="filter-budget" data-value="80-120">80-120元</button>
          <button class="sidebar-item" data-action="filter-budget" data-value="120-9999">120元以上</button>
        </div>
        <div class="sidebar-group">
          <div class="sidebar-title">需求状态</div>
          <button class="sidebar-item active" data-action="filter-status" data-value="">全部</button>
          <button class="sidebar-item" data-action="filter-status" data-value="open">待匹配</button>
          <button class="sidebar-item" data-action="filter-status" data-value="accepted">已接单</button>
          <button class="sidebar-item" data-action="filter-status" data-value="done">已完成</button>
        </div>
      </aside>
      <div class="boss-list">
        <div class="boss-filter">
          <input id="requestSearchInput" placeholder="搜索地点、服务、孩子昵称" autocomplete="off">
          <button class="small-btn" data-action="clear-request-search">重置</button>
        </div>
        <div id="requestListItems" class="request-list-items">
          ${requests.map(request => renderRequestListItem(request, selected?.id)).join("")}
        </div>
      </div>
      <section class="boss-detail">
        ${renderRequestDetail(selected, mode)}
      </section>
    </div>
  `;
}

function renderRequestListItem(request, selectedId) {
  const isUrgent = /今天|临时|紧急|马上|尽快/.test(`${request.date} ${request.service} ${request.note}`);
  return `
    <button class="request-list-item ${request.id === selectedId ? "active" : ""}" data-action="select-request" data-request="${request.id}">
      <div class="request-item-head">
        <span class="request-title">${escapeHtml(request.service)} ${isUrgent ? `<em class="urgency-badge">急</em>` : ""}</span>
        <span class="request-pay">${escapeHtml(request.budget)}元/时</span>
      </div>
      <span class="request-child">${escapeHtml(request.childName)} · ${escapeHtml(request.age)}岁</span>
      <span class="request-meta">${escapeHtml(request.area)} · ${escapeHtml(request.date)} ${escapeHtml(request.time)}</span>
      <div class="request-tags">
        <span class="tag">${escapeHtml(request.service)}</span>
        <span class="tag">${escapeHtml(request.area)}</span>
        ${isUrgent ? `<span class="tag hot">优先响应</span>` : ""}
      </div>
    </button>
  `;
}

function renderRequestDetail(request, mode) {
  if (!request) return emptyState("请选择一个需求", "点击左侧需求卡片后，这里会展示孩子信息、陪伴要求和推荐陪伴者。");
  const recommendations = bestProvidersFor(request);
  return `
    <div class="detail-head">
      <div>
        <span class="status ${request.status}">${statusLabel(request.status)}</span>
        <h2>${escapeHtml(request.service)}</h2>
        <p class="muted">${escapeHtml(request.area)} · ${escapeHtml(request.date)} ${escapeHtml(request.time)}</p>
      </div>
      <strong class="detail-pay">${escapeHtml(request.budget)} 元/小时</strong>
    </div>
    <div class="detail-section">
      <h3>孩子信息</h3>
      <p>${escapeHtml(request.childName)}，${escapeHtml(request.age)}岁</p>
    </div>
    <div class="detail-section">
      <h3>陪伴要求</h3>
      <p>${escapeHtml(request.note)}</p>
      ${tagRow([request.service, request.area, request.time])}
    </div>
    ${mode === "parent" && request.status === "open" ? `
      <div class="detail-section">
        <h3>智能推荐陪伴者</h3>
        <p class="muted match-intro">综合技能、认证、距离、评分和预算生成匹配分，仅作辅助判断，建议下单前先沟通关键细节。</p>
        <div class="recommend-list">
          ${recommendations.map(provider => `
            <article class="recommend-card">
              <div class="recommend-main">
                <div class="recommend-avatar">${escapeHtml(provider.name?.charAt(0) || "?")}</div>
                <div class="recommend-info">
                  <div class="recommend-title">
                    <h3>${escapeHtml(provider.name)} <span class="muted">· ${escapeHtml(provider.type)}</span></h3>
                    <span class="match-badge">${provider.match.label}</span>
                  </div>
                  <p>${escapeHtml(provider.distance)} · ${provider.price}元/时 · ${provider.verified ? "已认证" : "待认证"} · ${ratingStars(provider.rating)}</p>
                  <div class="match-meter" aria-label="匹配度 ${provider.match.score}%"><span style="width:${provider.match.score}%"></span><b>${provider.match.score}%</b></div>
                  <div class="match-reasons">
                    ${provider.match.reasons.map(reason => `<span>${escapeHtml(reason)}</span>`).join("")}
                  </div>
                  <div class="request-tags">${(provider.skills || []).slice(0, 3).map(skill => `<span class="tag">${escapeHtml(skill)}</span>`).join("")}</div>
                </div>
              </div>
              <div class="recommend-actions">
                <button class="primary-btn" data-action="book" data-request="${request.id}" data-provider="${provider.id}">立即下单</button>
                <button class="chat-btn" data-action="chat-provider" data-provider="${provider.id}">立即沟通</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    ` : ""}
    ${mode === "provider" && request.status === "open" ? `
      <div class="detail-section action-strip">
        <div>
          <h3>觉得合适？</h3>
          <p class="muted">接单后会生成订单，双方可在消息页沟通细节。</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="chat-btn" data-action="chat-parent" data-request="${request.id}">立即沟通</button>
          <button class="primary-btn" data-action="accept-request" data-request="${request.id}">我要接单</button>
        </div>
      </div>
    ` : ""}
    ${request.status !== "open" ? emptyState("需求已进入订单流程", "可以在“我的订单”中继续查看和管理进度。") : ""}
  `;
}

function renderRequestCard(request, withRecommendations) {
  const recommendations = bestProvidersFor(request);
  return `
    <article class="item-card highlight">
      <div class="panel-head">
        <div>
          <h3>${escapeHtml(request.childName)} · ${escapeHtml(request.age)}岁</h3>
          <p class="muted">${escapeHtml(request.area)}｜${escapeHtml(request.date)} ${escapeHtml(request.time)}</p>
        </div>
        <span class="status ${request.status}">${statusLabel(request.status)}</span>
      </div>
      ${tagRow([request.service, `预算 ${request.budget} 元/小时`])}
      <p>${escapeHtml(request.note)}</p>
      ${withRecommendations && request.status === "open" ? `
        <div class="divider"></div>
        <h3>推荐陪伴者</h3>
        <div class="grid">
          ${recommendations.map(provider => `
            <div class="item-card">
              <h3>${escapeHtml(provider.name)} <span class="muted">· ${escapeHtml(provider.type)}</span></h3>
              <p class="muted">${escapeHtml(provider.distance)}｜${provider.price} 元/小时｜${provider.verified ? "已认证" : "待认证"}</p>
              ${tagRow(provider.skills)}
              <button class="primary-btn" data-action="book" data-request="${request.id}" data-provider="${provider.id}">选择并下单</button>
            </div>
          `).join("")}
        </div>
      ` : state.user?.role === "provider" && request.status === "open" ? `
        <div class="card-actions"><button class="primary-btn" data-action="accept-request" data-request="${request.id}">我要接单</button></div>
      ` : ""}
    </article>
  `;
}

function renderRequests() {
  const mode = state.user?.role === "provider" ? "provider" : "parent";
  $("#requestsView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div><h2>${mode === "provider" ? "接单大厅" : "需求广场"}</h2><p>${mode === "provider" ? "像浏览岗位一样查看附近家庭需求，选择合适订单接单。" : "像管理招聘需求一样查看陪伴需求，并选择合适陪伴者。"}</p></div>
      </div>
      ${renderRequestBoard(state.requests, mode)}
    </section>
  `;
}

function providerStatus(provider) {
  // 基于 provider.id 生成稳定的状态：在线 / 忙碌 / 离线
  const seed = String(provider.id || provider.name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const states = [
    { key: "online", label: "在线", cls: "online" },
    { key: "online", label: "在线", cls: "online" },
    { key: "busy", label: "忙碌中", cls: "busy" },
    { key: "offline", label: "离线", cls: "offline" }
  ];
  return states[seed % states.length];
}

function avatarFor(name) {
  const ch = String(name || "?").trim().charAt(0) || "?";
  const palette = ["#FFB59A", "#FFD179", "#9DD6E8", "#B5C6FF", "#F2A0C0", "#A6E0B8"];
  const seed = ch.charCodeAt(0);
  const bg = palette[seed % palette.length];
  return `<span class="avatar" style="--avatar-bg:${bg}">${escapeHtml(ch)}</span>`;
}

function ratingStars(rating) {
  const num = Number(rating);
  if (!num) return `<span class="muted">暂无评分</span>`;
  const full = Math.floor(num);
  const half = num - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return `<span class="rating-stars" aria-label="评分 ${num}">${"★".repeat(full)}${half ? "☆" : ""}${"☆".repeat(empty)}<small>${num.toFixed(1)}</small></span>`;
}

function renderProviders() {
  const filter = state.providerFilter || "all";
  const enriched = state.providers.map(p => ({ ...p, _status: providerStatus(p) }));
  const counts = {
    all: enriched.length,
    online: enriched.filter(p => p._status.key === "online").length,
    busy: enriched.filter(p => p._status.key === "busy").length,
    verified: enriched.filter(p => p.verified).length
  };
  const filtered = enriched.filter(p => {
    if (filter === "online") return p._status.key === "online";
    if (filter === "busy") return p._status.key === "busy";
    if (filter === "verified") return p.verified;
    return true;
  });
  $("#providersView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>陪伴者列表</h2><p>认证陪伴者、技能标签和服务价格。</p></div></div>
      <div class="tabs order-tabs">
        <button class="tab ${filter === "all" ? "active" : ""}" data-action="filter-providers" data-value="all">全部 ${counts.all}</button>
        <button class="tab ${filter === "online" ? "active" : ""}" data-action="filter-providers" data-value="online">在线 ${counts.online}</button>
        <button class="tab ${filter === "busy" ? "active" : ""}" data-action="filter-providers" data-value="busy">忙碌 ${counts.busy}</button>
        <button class="tab ${filter === "verified" ? "active" : ""}" data-action="filter-providers" data-value="verified">认证 ${counts.verified}</button>
      </div>
      ${filtered.length ? `<div class="grid cols-3">
        ${filtered.map(provider => {
          const reviewCount = state.reviews.filter(review => review.providerId === provider.id).length;
          return `
          <article class="item-card provider-card ${state.provider?.id === provider.id ? "highlight" : ""}">
            <div class="provider-head">
              ${avatarFor(provider.name)}
              <div class="provider-meta">
                <h3>${escapeHtml(provider.name)}<span class="status-pill ${provider._status.cls}"><i class="status-pill-dot"></i>${provider._status.label}</span></h3>
                <p class="muted">${escapeHtml(provider.type)}｜${escapeHtml(provider.distance)}</p>
                <p>${ratingStars(provider.rating)}<span class="muted"> · ${reviewCount} 条评价 · ${provider.orders || 0} 单</span></p>
              </div>
              <span class="status ${provider.verified ? "open" : "matched"}">${provider.verified ? "已认证" : "待认证"}</span>
            </div>
            ${tagRow(provider.skills)}
            <p>${escapeHtml(provider.bio)}</p>
            <p class="muted">参考价格：<strong>${provider.price || 0}</strong> 元/小时</p>
            ${renderProviderReviews(provider.id)}
          </article>
        `; }).join("")}
      </div>` : emptyState("暂无符合条件的陪伴者", "切换筛选条件试试。")}
    </section>
  `;
}

function renderProviderReviews(providerId) {
  const reviews = state.reviews.filter(review => review.providerId === providerId).slice(0, 2);
  if (!reviews.length) return "";
  return `<div class="review-list">${reviews.map(review => `
    <div class="review-item">
      <strong>${"★".repeat(Number(review.rating || 0))}${"☆".repeat(5 - Number(review.rating || 0))}</strong>
      <p>${escapeHtml(review.text || "家长未填写文字评价")}</p>
    </div>
  `).join("")}</div>`;
}

function renderOrders() {
  const filter = state.orderFilter || "all";
  const counts = {
    all: state.orders.length,
    active: state.orders.filter(o => o.status === "accepted" || o.status === "arrived").length,
    done: state.orders.filter(o => o.status === "done" && !o.review).length,
    reviewed: state.orders.filter(o => o.review).length
  };
  const filtered = state.orders.filter(order => {
    if (filter === "active") return order.status === "accepted" || order.status === "arrived";
    if (filter === "done") return order.status === "done" && !order.review;
    if (filter === "reviewed") return Boolean(order.review);
    return true;
  });
  $("#ordersView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>订单管理</h2><p>管理当前登录账号相关订单。</p></div></div>
      ${state.user ? `
        <div class="tabs order-tabs">
          <button class="tab ${filter === "all" ? "active" : ""}" data-action="filter-orders" data-value="all">全部 ${counts.all}</button>
          <button class="tab ${filter === "active" ? "active" : ""}" data-action="filter-orders" data-value="active">进行中 ${counts.active}</button>
          <button class="tab ${filter === "done" ? "active" : ""}" data-action="filter-orders" data-value="done">待评价 ${counts.done}</button>
          <button class="tab ${filter === "reviewed" ? "active" : ""}" data-action="filter-orders" data-value="reviewed">已评价 ${counts.reviewed}</button>
        </div>
        ${filtered.length ? `<div class="grid cols-2">${filtered.map(renderOrderCard).join("")}</div>` : emptyState("没有匹配的订单", "切换其他筛选条件试试，或先发布陪伴需求。")}
      ` : requireLoginText()}
    </section>
  `;
}

function orderProgress(order) {
  const steps = [
    { key: "accepted", label: "已接单" },
    { key: "arrived", label: "陪伴中" },
    { key: "done", label: "已完成" },
    { key: "reviewed", label: "已评价" }
  ];
  const currentIdx = order.review ? 3 : steps.findIndex(s => s.key === order.status);
  return `<div class="progress-bar">${steps.map((step, i) => {
    const cls = i < currentIdx ? "done" : i === currentIdx ? "active" : "";
    return `<span class="progress-step ${cls}">${step.label}</span>`;
  }).join("")}</div>`;
}

function renderOrderCard(order) {
  return `
    <article class="item-card">
      <div class="panel-head">
        <div><h3>${escapeHtml(order.service)}</h3><p class="muted">${escapeHtml(order.date)} ${escapeHtml(order.time)}｜${escapeHtml(order.area)}</p></div>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>
      ${orderProgress(order)}
      <p><strong>孩子：</strong>${escapeHtml(order.childName)}　<strong>陪伴者：</strong>${escapeHtml(order.providerName)}</p>
      <p class="muted">参考价格：${escapeHtml(order.price)} 元/小时</p>
      ${order.feedback ? `<p><strong>陪伴反馈：</strong>${escapeHtml(order.feedback)}</p>` : ""}
      ${order.report ? `
        <div class="mini-card">
          <strong>陪伴记录</strong>
          <p><b>活动：</b>${escapeHtml(order.report.activities)}</p>
          <p><b>情绪：</b>${escapeHtml(order.report.mood || "未填写")}</p>
          <p><b>作业：</b>${escapeHtml(order.report.homework || "未填写")}</p>
          <p><b>建议：</b>${escapeHtml(order.report.suggestion || "未填写")}</p>
        </div>
      ` : ""}
      ${order.review ? `
        <div class="mini-card">
          <strong>家长评价：${"★".repeat(Number(order.review.rating || 0))}${"☆".repeat(5 - Number(order.review.rating || 0))}</strong>
          <p>${escapeHtml(order.review.text || "家长未填写文字评价")}</p>
        </div>
      ` : ""}
      ${state.user?.role === "provider" && (order.status === "arrived" || order.status === "done") ? `
        <form class="form-grid compact-form" data-form="report" data-order="${order.id}">
          <div class="field full"><label>陪伴活动记录</label><textarea name="activities" required>${escapeHtml(order.report?.activities || "")}</textarea></div>
          <div class="field"><label>孩子情绪</label><input name="mood" value="${escapeHtml(order.report?.mood || "")}"></div>
          <div class="field"><label>作业/任务情况</label><input name="homework" value="${escapeHtml(order.report?.homework || "")}"></div>
          <div class="field full"><label>给家长的建议</label><textarea name="suggestion">${escapeHtml(order.report?.suggestion || "")}</textarea></div>
          <div class="field full"><button class="ghost-btn" type="submit">保存陪伴记录</button></div>
        </form>
      ` : ""}
      ${state.user?.role === "parent" && order.status === "done" && !order.review ? `
        <form class="form-grid compact-form" data-form="review" data-order="${order.id}">
          <div class="field"><label>评分</label><select name="rating"><option value="5">5分</option><option value="4">4分</option><option value="3">3分</option><option value="2">2分</option><option value="1">1分</option></select></div>
          <div class="field full"><label>评价内容</label><textarea name="text" placeholder="这次陪伴哪里做得好？有什么建议？"></textarea></div>
          <div class="field full"><button class="ghost-btn" type="submit">提交评价</button></div>
        </form>
      ` : ""}
      <div class="card-actions">
        ${order.status === "accepted" ? `<button class="primary-btn" data-action="order-arrived" data-order="${order.id}">开始陪伴</button>` : ""}
        ${order.status === "arrived" ? `<button class="primary-btn" data-action="order-done" data-order="${order.id}">完成订单</button>` : ""}
        <button class="ghost-btn" data-view="messages">去沟通</button>
      </div>
    </article>
  `;
}

function renderMessages() {
  if (!state.user || !state.orders.length) {
    $("#messagesView").innerHTML = `
      <section class="panel">
        <div class="panel-head"><div><h2>订单消息</h2><p>家长和陪伴者围绕订单沟通。</p></div></div>
        ${emptyState("还不能发送消息", "登录并创建订单后即可围绕订单发送消息。")}
      </section>
    `;
    return;
  }

  // 按订单聚合会话
  const threads = state.orders.map(order => {
    const msgs = state.messages.filter(m => m.orderId === order.id);
    const last = msgs[msgs.length - 1];
    return {
      order,
      messages: msgs,
      last,
      lastTime: last ? new Date(last.createdAt).getTime() : new Date(order.createdAt || 0).getTime(),
      unread: msgs.filter(m => m.senderRole !== state.user.role && m.senderRole !== "system").length
    };
  }).sort((a, b) => b.lastTime - a.lastTime);

  // 默认选中最近一个
  if (!state.selectedThreadId || !threads.find(t => t.order.id === state.selectedThreadId)) {
    state.selectedThreadId = threads[0]?.order.id || null;
  }
  const active = threads.find(t => t.order.id === state.selectedThreadId);

  $("#messagesView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>订单消息</h2><p>按订单分组的实时沟通，支持快速切换会话。</p></div></div>
      <div class="thread-layout">
        <aside class="thread-list" role="tablist" aria-label="会话列表">
          ${threads.map(t => {
            const peer = state.user.role === "parent" ? t.order.providerName : t.order.childName;
            const preview = t.last ? t.last.text : "暂无消息，发送第一条吧";
            const time = t.last ? new Date(t.last.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
            return `
              <button class="thread-item ${t.order.id === state.selectedThreadId ? "active" : ""}" data-action="open-thread" data-thread="${t.order.id}" role="tab" aria-selected="${t.order.id === state.selectedThreadId}">
                ${avatarFor(peer)}
                <div class="thread-text">
                  <div class="thread-title">
                    <strong>${escapeHtml(peer || "未知")}</strong>
                    <small class="muted">${escapeHtml(time)}</small>
                  </div>
                  <div class="thread-preview">
                    <span class="muted">${escapeHtml(t.order.service)}</span>
                    <span class="thread-preview-text">${escapeHtml(preview)}</span>
                  </div>
                </div>
                ${t.unread ? `<span class="unread-dot" aria-label="${t.unread} 条未读">${t.unread}</span>` : ""}
              </button>
            `;
          }).join("")}
        </aside>
        <div class="thread-detail" role="tabpanel">
          ${active ? `
            <div class="thread-head">
              <div>
                <h3>${escapeHtml(state.user.role === "parent" ? active.order.providerName : active.order.childName)}</h3>
                <p class="muted">${escapeHtml(active.order.service)} · ${escapeHtml(active.order.date)} ${escapeHtml(active.order.time)}</p>
              </div>
              <span class="status ${active.order.status}">${statusLabel(active.order.status)}</span>
            </div>
            <div class="message-list thread-messages">
              ${active.messages.length ? active.messages.map(message => `
                <div class="message ${message.senderRole === state.user.role ? "mine" : ""} ${message.senderRole === "system" ? "system" : ""}">
                  <p>${escapeHtml(message.text)}</p>
                  <small>${message.senderRole === "system" ? "系统" : message.senderRole === "parent" ? "家长" : "陪伴者"} · ${new Date(message.createdAt).toLocaleString("zh-CN")}</small>
                </div>
              `).join("") : emptyState("暂无消息", "发送第一条消息开启沟通。")}
            </div>
            <form id="messageForm" class="thread-input">
              <input type="hidden" name="orderId" value="${active.order.id}">
              <textarea name="text" required placeholder="输入消息内容，回车发送（Shift+回车换行）"></textarea>
              <button class="primary-btn" type="submit">发送</button>
            </form>
          ` : emptyState("还没有会话", "创建订单后即可在这里沟通。")}
        </div>
      </div>
    </section>
  `;

  // 回车发送
  const ta = $("#messageForm textarea");
  if (ta) {
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#messageForm").requestSubmit();
      }
    });
  }
}

let refreshReveal = () => {};

// 滚动进场动画：让主要区块进入视口时轻微浮现
function initScrollReveal() {
  const targets = [
    ".hero-panel",
    ".stats-grid article",
    ".panel",
    ".item-card",
    ".boss-board",
    ".recommend-card",
    ".message"
  ].join(",");

  if (!("IntersectionObserver" in window)) {
    return () => document.querySelectorAll(targets).forEach(el => el.classList.add("is-visible"));
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  return () => {
    document.querySelectorAll(targets).forEach((el, index) => {
      if (el.dataset.revealReady) return;
      el.dataset.revealReady = "true";
      el.classList.add("reveal-on-scroll");
      el.style.transitionDelay = `${Math.min(index % 8, 5) * 35}ms`;
      observer.observe(el);
    });
  };
}

// ===== 个人中心 =====
function renderProfile() {
  const root = $("#profileView");
  if (!state.user) {
    root.innerHTML = `<section class="panel">${requireLoginText()}</section>`;
    return;
  }
  const u = state.user;
  const myOrders = state.orders.filter(o => {
    if (u.role === "parent") return true;
    return o.providerId === state.provider?.id;
  });
  const myMessages = state.messages.filter(m => m.senderRole === u.role).length;
  const myReviews = state.reviews.length;
  const themeCurrent = document.documentElement.getAttribute("data-theme") || "auto";
  const fontCurrent = document.documentElement.getAttribute("data-fontsize") || "normal";

  root.innerHTML = `
    <section class="panel profile-hero">
      <div class="profile-head">
        ${avatarFor(u.name)}
        <div>
          <h2>${escapeHtml(u.name)}</h2>
          <p class="muted">${u.role === "parent" ? "家长" : "陪伴者"} · ${escapeHtml(u.phone || "未绑定手机")} · ${escapeHtml(u.area || "未设置区域")}</p>
        </div>
        <span class="status ${u.role === "parent" ? "open" : "matched"}">${u.role === "parent" ? "家长账号" : "陪伴者账号"}</span>
      </div>
      <div class="profile-stats">
        <div><strong>${myOrders.length}</strong><span>订单总数</span></div>
        <div><strong>${myMessages}</strong><span>发送消息</span></div>
        <div><strong>${myReviews}</strong><span>${u.role === "parent" ? "已写评价" : "收到评价"}</span></div>
        <div><strong>${state.children.length}</strong><span>${u.role === "parent" ? "孩子档案" : "服务区域"}</span></div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>账号信息</h2><p>修改你的基本信息，保存后立即生效。</p></div></div>
      <form id="profileForm" class="form-grid">
        <div class="field"><label>姓名/昵称</label><input name="name" value="${escapeHtml(u.name || "")}" required></div>
        <div class="field"><label>手机号</label><input name="phone" value="${escapeHtml(u.phone || "")}" required></div>
        <div class="field"><label>所在区域</label><input name="area" value="${escapeHtml(u.area || "")}" placeholder="例如：绿芽小区"></div>
        <div class="field"><label>身份</label><input value="${u.role === "parent" ? "家长" : "陪伴者"}" disabled></div>
        <div class="field full"><button class="primary-btn" type="submit">保存修改</button></div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>偏好设置</h2><p>主题和字号会保存在本地，下次打开自动恢复。</p></div></div>
      <div class="pref-list">
        <div class="pref-item">
          <div><strong>显示主题</strong><p class="muted">当前：${themeCurrent === "dark" ? "深色" : themeCurrent === "light" ? "浅色" : "跟随系统"}</p></div>
          <button class="ghost-btn" data-action="toggle-theme-pref">切换主题</button>
        </div>
        <div class="pref-item">
          <div><strong>字号大小</strong><p class="muted">当前：${fontCurrent === "large" ? "大字号" : "标准字号"}</p></div>
          <button class="ghost-btn" data-action="toggle-font-pref">切换字号</button>
        </div>
        <div class="pref-item">
          <div><strong>新手引导</strong><p class="muted">重新显示首页的新手引导横幅</p></div>
          <button class="ghost-btn" data-action="reset-onboarding">重新显示</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>账号操作</h2><p>退出登录或清除本地缓存。</p></div></div>
      <div class="pref-list">
        <div class="pref-item">
          <div><strong>退出登录</strong><p class="muted">退出当前账号，需要重新登录才能使用平台功能。</p></div>
          <button class="ghost-btn" data-action="logout">退出登录</button>
        </div>
        <div class="pref-item">
          <div><strong>清除本地缓存</strong><p class="muted">清除主题、字号和引导记录，不影响账号数据。</p></div>
          <button class="ghost-btn" data-action="clear-cache">清除缓存</button>
        </div>
      </div>
    </section>
  `;
}

// ===== 帮助中心 =====
function renderHelp() {
  const root = $("#helpView");
  const faqs = [
    { q: "如何发布陪伴需求？", a: "登录家长账号后，在首页点击「发布陪伴需求」，填写孩子昵称、年龄、服务地点、日期时间、陪伴类型和预算，提交后需求会进入需求广场，等待陪伴者接单。" },
    { q: "如何选择推荐陪伴者？", a: "在需求详情页，系统会根据技能匹配、认证状态、评分、价格和距离生成推荐列表。每个陪伴者会显示匹配分和匹配理由，点击「立即下单」即可创建订单。" },
    { q: "陪伴者如何接单？", a: "登录陪伴者账号后，在「需求广场」查看附近需求。选择合适的需求后点击「我要接单」，订单会自动生成，双方可以在消息页沟通细节。" },
    { q: "订单状态有哪些？", a: "订单状态包括：已接单 → 陪伴中 → 已完成 → 已评价。陪伴者可以在「开始陪伴」和「完成订单」之间更新状态，家长可以在完成后提交评价。" },
    { q: "如何填写陪伴记录？", a: "陪伴者在订单状态为「陪伴中」或「已完成」时，可以在订单卡片中填写陪伴活动、孩子情绪、作业情况和给家长的建议。这些记录会沉淀到孩子成长摘要中。" },
    { q: "消息如何按订单分组？", a: "消息页采用左右分栏布局，左侧是按订单分组的会话列表，按最近消息时间排序。点击某个会话即可查看该订单的全部消息，支持回车发送。" },
    { q: "如何切换深色模式？", a: "点击顶部工具栏的太阳/月亮图标可以手动切换深浅色主题。如果不手动切换，平台会自动跟随系统的颜色偏好。设置会保存在本地。" },
    { q: "快捷键有哪些？", a: "Ctrl/Cmd+K 打开命令面板；1-5 数字键快速切换页面；Esc 关闭弹窗。命令面板支持搜索跳转和快捷操作。" },
    { q: "如何查看通知？", a: "顶部工具栏的铃铛图标显示当前待办数量。点击铃铛可以展开通知面板，查看待办事项并直接跳转处理。" },
    { q: "试用账号是什么？", a: "家长账号：13800000000 / 123456；陪伴者账号：13900000000 / 123456。可以直接登录体验全部功能。" }
  ];

  const guides = state.user?.role === "provider" ? [
    { icon: "📝", title: "完善主页", text: "填写简介、技能标签和时薪" },
    { icon: "🛡️", title: "完成认证", text: "提升可信度，获得更多订单" },
    { icon: "🔍", title: "浏览需求", text: "在接单大厅查看附近需求" },
    { icon: "✅", title: "接单沟通", text: "接单后在消息页与家长确认细节" },
    { icon: "📋", title: "陪伴记录", text: "填写活动、情绪和建议" }
  ] : [
    { icon: "👶", title: "建立档案", text: "添加孩子信息和注意事项" },
    { icon: "📢", title: "发布需求", text: "描述时间、地点和服务类型" },
    { icon: "🤝", title: "选择陪伴者", text: "查看匹配分并下单" },
    { icon: "💬", title: "订单沟通", text: "在消息页确认陪伴细节" },
    { icon: "⭐", title: "评价反馈", text: "完成后评价，帮助其他家长" }
  ];

  root.innerHTML = `
    <section class="panel help-hero">
      <div class="panel-head"><div><h2>帮助中心</h2><p>在这里找到使用指南、常见问题和平台规则。</p></div></div>
      <div class="help-guides">
        ${guides.map(g => `
          <div class="help-guide-card">
            <span class="help-guide-icon">${g.icon}</span>
            <strong>${escapeHtml(g.title)}</strong>
            <p class="muted">${escapeHtml(g.text)}</p>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>常见问题</h2><p>点击问题展开查看答案。</p></div></div>
      <div class="faq-list">
        ${faqs.map((faq, i) => `
          <details class="faq-item" ${i === 0 ? "open" : ""}>
            <summary>
              <span>${escapeHtml(faq.q)}</span>
              <i class="faq-arrow" aria-hidden="true"></i>
            </summary>
            <div class="faq-answer"><p>${escapeHtml(faq.a)}</p></div>
          </details>
        `).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>平台规则</h2><p>使用伴芽平台需要遵守以下基本规则。</p></div></div>
      <div class="rules-list">
        <article class="rule-item">
          <span class="rule-num">1</span>
          <div><strong>实名与认证</strong><p>陪伴者需完成认证后才能接单，家长需提供真实孩子信息。</p></div>
        </article>
        <article class="rule-item">
          <span class="rule-num">2</span>
          <div><strong>安全第一</strong><p>首次陪伴建议在公共场所见面，确认身份后再前往家中。</p></div>
        </article>
        <article class="rule-item">
          <span class="rule-num">3</span>
          <div><strong>订单内沟通</strong><p>关键约定请通过平台消息确认，便于后续追踪和留痕。</p></div>
        </article>
        <article class="rule-item">
          <span class="rule-num">4</span>
          <div><strong>如实评价</strong><p>完成后请如实评价，帮助其他家庭做出选择。</p></div>
        </article>
        <article class="rule-item">
          <span class="rule-num">5</span>
          <div><strong>隐私保护</strong><p>不要在公开区域透露孩子详细住址和联系方式，通过平台沟通。</p></div>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>联系我们</h2><p>遇到问题可以通过以下方式反馈。</p></div></div>
      <div class="contact-grid">
        <div class="contact-card">
          <span class="contact-icon">💬</span>
          <strong>在线反馈</strong>
          <p class="muted">在消息页选择系统会话留言</p>
        </div>
        <div class="contact-card">
          <span class="contact-icon">📧</span>
          <strong>邮件联系</strong>
          <p class="muted">support@banya.example</p>
        </div>
        <div class="contact-card">
          <span class="contact-icon">⏰</span>
          <strong>服务时间</strong>
          <p class="muted">每日 8:00 - 22:00</p>
        </div>
      </div>
    </section>
  `;
}

function render() {
  renderStats();
  renderAuth();
  $all(".role-btn[data-role]").forEach(btn => btn.classList.toggle("active", btn.dataset.role === state.role));
  $all(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));
  // 视图切换用 switchView 实现过渡动画
  if (!$(".view.active")) {
    $(`#${state.view}View`)?.classList.add("active");
  }
  renderDashboard();
  renderRequests();
  renderProviders();
  renderOrders();
  renderMessages();
  renderProfile();
  renderHelp();
  updateNotifyBadge();
  window.requestAnimationFrame(() => refreshReveal());
}

async function handleAction(actionBtn) {
  const action = actionBtn.dataset.action;
  if (action === "scroll-create") {
    state.view = "dashboard";
    render();
    window.setTimeout(() => $("#createRequestPanel")?.scrollIntoView({ behavior: "smooth" }), 80);
  }
  if (action === "fill-demo-request") {
    const form = $("#requestForm");
    if (!form) return;
    form.childName.value = "小芽";
    form.age.value = 8;
    form.area.value = state.user?.area || "阳光花园";
    form.date.value = "今天";
    form.time.value = "15:50-18:20";
    form.service.value = "作业引导 + 情绪陪聊";
    form.budget.value = 85;
    form.note.value = "孩子最近放学后容易刷短视频，希望有人陪他先吃点东西，再完成作业和阅读。";
    toast("已填入示例需求");
  }
  if (action === "select-request") {
    state.selectedRequestId = actionBtn.dataset.request;
    render();
  }
  if (action === "dismiss-onboarding") {
    if (state.user) localStorage.setItem(`banya-onboarding-${state.user.id}`, "1");
    render();
    toast("引导已关闭，随时可以开始");
    return;
  }
  if (action === "toggle-theme-pref") {
    toggleTheme();
    render();
    return;
  }
  if (action === "toggle-font-pref") {
    toggleFontSize();
    render();
    return;
  }
  if (action === "reset-onboarding") {
    if (state.user) localStorage.removeItem(`banya-onboarding-${state.user.id}`);
    state.view = "dashboard";
    render();
    toast("新手引导已重新显示");
    return;
  }
  if (action === "logout") {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    state.user = null;
    state.provider = null;
    state.view = "dashboard";
    toast("已退出登录");
    await refresh();
    return;
  }
  if (action === "clear-cache") {
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(FONTSIZE_KEY);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-fontsize");
    toast("本地缓存已清除");
    render();
    return;
  }
  if (action === "clear-request-search") {
    const input = $("#requestSearchInput");
    if (input) input.value = "";
    $all(".request-list-item").forEach(item => item.hidden = false);
  }
  if (action === "filter-orders") {
    state.orderFilter = actionBtn.dataset.value || "all";
    render();
  }
  if (action === "filter-providers") {
    state.providerFilter = actionBtn.dataset.value || "all";
    render();
  }
  if (action === "open-thread") {
    state.selectedThreadId = actionBtn.dataset.thread || null;
    render();
  }
  if (action === "filter-service" || action === "filter-budget" || action === "filter-status") {
    const group = actionBtn.parentElement;
    $all(".sidebar-item", group).forEach(btn => btn.classList.remove("active"));
    actionBtn.classList.add("active");
    const filterType = action.replace("filter-", "");
    const filterValue = actionBtn.dataset.value;
    const allItems = $all(".request-list-item");
    allItems.forEach(item => {
      const request = state.requests.find(r => r.id === item.dataset.request);
      if (!request) return;
      let match = true;
      if (filterType === "service" && filterValue) {
        match = request.service.includes(filterValue);
      }
      if (filterType === "budget" && filterValue) {
        const [min, max] = filterValue.split("-").map(Number);
        match = Number(request.budget) >= min && Number(request.budget) <= max;
      }
      if (filterType === "status" && filterValue) {
        match = request.status === filterValue;
      }
      const searchInput = $("#requestSearchInput");
      const keyword = searchInput?.value.trim().toLowerCase();
      if (match && keyword) {
        match = item.textContent.toLowerCase().includes(keyword);
      }
      item.hidden = !match;
    });
  }
  if (action === "chat-provider" || action === "chat-parent") {
    state.view = "messages";
    render();
    toast("已跳转到消息页，可在此沟通");
  }
  if (action === "global-search") {
    const keyword = $("#globalSearch")?.value.trim().toLowerCase();
    if (keyword) {
      state.view = "requests";
      render();
      window.setTimeout(() => {
        const input = $("#requestSearchInput");
        if (input) {
          input.value = keyword;
          input.dispatchEvent(new Event("input"));
        }
      }, 100);
    } else {
      state.view = "requests";
      render();
    }
  }
  if (action === "book") {
    await api(`/api/requests/${actionBtn.dataset.request}/book`, {
      method: "POST",
      body: { providerId: actionBtn.dataset.provider }
    });
    toast("下单成功");
    state.view = "orders";
    await refresh();
  }
  if (action === "accept-request") {
    await api(`/api/requests/${actionBtn.dataset.request}/accept`, { method: "POST" });
    toast("接单成功");
    state.view = "orders";
    await refresh();
  }
  if (action === "verify-provider") {
    await api("/api/providers/me/verify", { method: "POST" });
    toast("已模拟完成认证");
    await refresh();
  }
  if (action === "order-arrived" || action === "order-done") {
    await api(`/api/orders/${actionBtn.dataset.order}/status`, {
      method: "PATCH",
      body: { status: action === "order-arrived" ? "arrived" : "done" }
    });
    toast(action === "order-arrived" ? "已开始陪伴" : "订单已完成");
    await refresh();
  }
}

document.addEventListener("click", async event => {
  const authTab = event.target.closest("[data-auth-mode]");
  if (authTab) {
    state.authMode = authTab.dataset.authMode;
    render();
    return;
  }

  const accountBtn = event.target.closest("#accountBtn");
  if (accountBtn && state.user) {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    state.user = null;
    state.provider = null;
    toast("已退出登录");
    await refresh();
    return;
  }

  const roleBtn = event.target.closest("[data-role]");
  if (roleBtn) {
    if (state.user && state.user.role !== roleBtn.dataset.role) {
      toast("当前账号身份不能切换，请退出后登录对应身份");
      return;
    }
    state.role = roleBtn.dataset.role;
    render();
  }

  const viewBtn = event.target.closest("[data-view]");
  if (viewBtn) {
    switchView(viewBtn.dataset.view);
    render();
  }

  const actionBtn = event.target.closest("[data-action]");
  if (actionBtn) {
    if (actionBtn.dataset.action === "close-command") {
      closeCommandPalette();
      return;
    }
    try {
      setButtonLoading(actionBtn, true);
      await handleAction(actionBtn);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setButtonLoading(actionBtn, false);
    }
  }

  const commandBtn = event.target.closest("#commandBtn");
  if (commandBtn) {
    openCommandPalette();
    return;
  }

  const notifyBtn = event.target.closest("#notifyBtn");
  if (notifyBtn) {
    const panel = $("#notifyPanel");
    const isOpen = !panel.hidden;
    if (isOpen) {
      panel.hidden = true;
      notifyBtn.setAttribute("aria-expanded", "false");
    } else {
      renderNotifyPanel();
      panel.hidden = false;
      notifyBtn.setAttribute("aria-expanded", "true");
    }
    return;
  }

  // 点击通知面板里的项目，跳转对应视图并关闭面板
  const notifyItem = event.target.closest(".notify-panel-item");
  if (notifyItem) {
    const view = notifyItem.dataset.view;
    $("#notifyPanel").hidden = true;
    $("#notifyBtn")?.setAttribute("aria-expanded", "false");
    if (view) {
      switchView(view);
      render();
    }
    return;
  }

  const commandItem = event.target.closest("[data-command]");
  if (commandItem) {
    runActiveCommand(commandItem.dataset.command);
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "commandInput") {
    activeCommandIndex = 0;
    renderCommandList();
    return;
  }
  if (event.target.id !== "requestSearchInput") return;
  const keyword = event.target.value.trim().toLowerCase();
  $all(".request-list-item").forEach(item => {
    item.hidden = keyword && !item.textContent.toLowerCase().includes(keyword);
  });
});

document.addEventListener("keydown", event => {
  const paletteOpen = $("#commandPalette")?.classList.contains("show");
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    paletteOpen ? closeCommandPalette() : openCommandPalette();
    return;
  }
  if (event.key === "Escape" && paletteOpen) {
    closeCommandPalette();
    return;
  }
  if (paletteOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    const total = filteredCommands().length;
    if (!total) return;
    activeCommandIndex = event.key === "ArrowDown"
      ? (activeCommandIndex + 1) % total
      : (activeCommandIndex - 1 + total) % total;
    renderCommandList();
    return;
  }
  if (paletteOpen && event.key === "Enter") {
    event.preventDefault();
    runActiveCommand();
    return;
  }
  if (event.target.matches("input, textarea, select")) return;
  const viewShortcuts = { "1": "dashboard", "2": "requests", "3": "providers", "4": "orders", "5": "messages" };
  if (viewShortcuts[event.key]) {
    switchViewAndRender(viewShortcuts[event.key]);
  }
});

document.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  if (!validateForm(form)) return;
  const submitButton = form.querySelector("[type='submit']");
  setButtonLoading(submitButton, true);
  try {
    if (form.id === "loginForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      const result = await api("/api/auth/login", { method: "POST", body: data });
      localStorage.setItem(TOKEN_KEY, result.token);
      toast("登录成功", "success");
      await refresh();
    }
    if (form.id === "registerForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      const result = await api("/api/auth/register", { method: "POST", body: data });
      localStorage.setItem(TOKEN_KEY, result.token);
      toast("注册成功", "success");
      await refresh();
    }
    if (form.id === "requestForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/requests", { method: "POST", body: data });
      state.view = "requests";
      toast("需求已发布", "success");
      await refresh();
    }
    if (form.id === "childForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/children", {
        method: "POST",
        body: {
          ...data,
          interests: data.interests.split(/[，,]/).map(item => item.trim()).filter(Boolean)
        }
      });
      form.reset();
      toast("孩子档案已保存", "success");
      await refresh();
    }
    if (form.id === "providerForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/providers/me", {
        method: "PUT",
        body: {
          ...data,
          skills: data.skills.split(/[，,]/).map(item => item.trim()).filter(Boolean)
        }
      });
      toast("陪伴者主页已保存", "success");
      await refresh();
    }
    if (form.id === "verificationForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/providers/me/verification", { method: "POST", body: data });
      form.reset();
      toast("认证申请已提交，等待审核", "success");
      await refresh();
    }
    if (form.dataset.form === "report") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api(`/api/orders/${form.dataset.order}/report`, { method: "POST", body: data });
      toast("陪伴记录已保存", "success");
      await refresh();
    }
    if (form.dataset.form === "review") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api(`/api/orders/${form.dataset.order}/review`, { method: "POST", body: data });
      toast("评价已提交", "success");
      await refresh();
    }
    if (form.id === "messageForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/messages", { method: "POST", body: data });
      form.reset();
      toast("消息已发送", "success");
      await refresh();
    }
    if (form.id === "profileForm") {
      const data = Object.fromEntries(new FormData(form).entries());
      await api("/api/auth/profile", { method: "PUT", body: data });
      toast("账号信息已保存", "success");
      await refresh();
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
});

// 主题和字号初始化
initTheme();
initFontSize();
refreshReveal = initScrollReveal();
refresh();

// 主题切换
$("#themeToggle")?.addEventListener("click", toggleTheme);

// 字号切换
$("#fontSizeBtn")?.addEventListener("click", toggleFontSize);

// 监听系统主题变化（仅在用户未手动设置时）
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem(THEME_KEY)) {
    render();
  }
});
