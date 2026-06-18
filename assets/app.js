const TOKEN_KEY = "banya-auth-token";

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
  apiOnline: true
};

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

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2400);
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
  return `<div class="empty">请先登录或注册账号，才能使用发布需求、接单、订单和消息功能。</div>`;
}

function renderStats() {
  $("#statRequests").textContent = state.requests.length;
  $("#statProviders").textContent = state.providers.length;
  $("#statOrders").textContent = state.orders.filter(order => order.status !== "done").length;
  $("#statMessages").textContent = state.messages.length;
  $("#todayText").textContent = new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const latest = state.requests.find(item => item.status === "open");
  $("#phoneRecommend").textContent = latest
    ? `最新需求：${latest.area}，${latest.time}，需要${latest.service}。`
    : "暂无待匹配需求，可以先发布一个陪伴需求。";
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
      </div>` : `<div class="empty">还没有孩子档案。</div>`}
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

function bestProvidersFor(request) {
  return state.providers
    .map(provider => {
      const text = `${request.service} ${request.note}`;
      const score = (provider.skills || []).reduce((sum, skill) => sum + (text.includes(skill.slice(0, 2)) ? 2 : 0), 0) + (provider.verified ? 2 : 0);
      return { ...provider, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
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
        ${openRequests.length ? renderRequestBoard(openRequests, "parent") : `<div class="empty">暂无待匹配需求。</div>`}
      </section>
    `;
  } else {
    root.innerHTML = `
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
  if (!requests.length) return `<div class="empty">暂无需求。</div>`;
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
  if (!requests.length) return `<div class="empty">暂无需求。</div>`;
  return `
    <div class="boss-board">
      <aside class="boss-list">
        <div class="boss-filter">
          <input id="requestSearchInput" placeholder="搜索地点、服务、孩子昵称">
          <button class="small-btn" data-action="clear-request-search">重置</button>
        </div>
        <div id="requestListItems" class="request-list-items">
          ${requests.map(request => renderRequestListItem(request, selected?.id)).join("")}
        </div>
      </aside>
      <section class="boss-detail">
        ${renderRequestDetail(selected, mode)}
      </section>
    </div>
  `;
}

function renderRequestListItem(request, selectedId) {
  return `
    <button class="request-list-item ${request.id === selectedId ? "active" : ""}" data-action="select-request" data-request="${request.id}">
      <span class="request-title">${escapeHtml(request.service)}</span>
      <span class="request-child">${escapeHtml(request.childName)} · ${escapeHtml(request.age)}岁</span>
      <span class="request-meta">${requestMeta(request)}</span>
      <span class="request-pay">${escapeHtml(request.budget)} 元/小时</span>
    </button>
  `;
}

function renderRequestDetail(request, mode) {
  if (!request) return `<div class="empty">请选择一个需求。</div>`;
  const recommendations = bestProvidersFor(request);
  return `
    <div class="detail-head">
      <div>
        <span class="status ${request.status}">${statusLabel(request.status)}</span>
        <h2>${escapeHtml(request.service)}</h2>
        <p class="muted">${requestMeta(request)}</p>
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
        <h3>推荐陪伴者</h3>
        <div class="recommend-list">
          ${recommendations.map(provider => `
            <article class="recommend-card">
              <div>
                <h3>${escapeHtml(provider.name)} <span class="muted">· ${escapeHtml(provider.type)}</span></h3>
                <p class="muted">${escapeHtml(provider.distance)}｜${provider.price} 元/小时｜${provider.verified ? "已认证" : "待认证"}</p>
                ${tagRow(provider.skills)}
              </div>
              <button class="primary-btn" data-action="book" data-request="${request.id}" data-provider="${provider.id}">立即下单</button>
            </article>
          `).join("")}
        </div>
      </div>
    ` : ""}
    ${mode === "provider" && request.status === "open" ? `
      <div class="detail-section action-strip">
        <div>
          <h3>觉得合适？</h3>
          <p class="muted">接单后会生成订单，家长和陪伴者可以继续在消息页沟通细节。</p>
        </div>
        <button class="primary-btn" data-action="accept-request" data-request="${request.id}">我要接单</button>
      </div>
    ` : ""}
    ${request.status !== "open" ? `<div class="empty">这个需求已经进入订单流程。</div>` : ""}
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

function renderProviders() {
  $("#providersView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>陪伴者列表</h2><p>认证陪伴者、技能标签和服务价格。</p></div></div>
      <div class="grid cols-3">
        ${state.providers.map(provider => `
          <article class="item-card ${state.provider?.id === provider.id ? "highlight" : ""}">
            <div class="panel-head">
              <div><h3>${escapeHtml(provider.name)}</h3><p class="muted">${escapeHtml(provider.type)}｜${escapeHtml(provider.distance)}</p></div>
              <span class="status ${provider.verified ? "open" : "matched"}">${provider.verified ? "已认证" : "待认证"}</span>
            </div>
            ${tagRow(provider.skills)}
            <p>${escapeHtml(provider.bio)}</p>
            <p class="muted">评分：${provider.rating || "暂无"}｜评价：${state.reviews.filter(review => review.providerId === provider.id).length} 条｜服务：${provider.orders || 0} 单｜${provider.price || 0} 元/小时</p>
            ${renderProviderReviews(provider.id)}
          </article>
        `).join("")}
      </div>
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
  $("#ordersView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>订单管理</h2><p>管理当前登录账号相关订单。</p></div></div>
      ${state.user ? (state.orders.length ? `<div class="grid cols-2">${state.orders.map(renderOrderCard).join("")}</div>` : `<div class="empty">暂无订单。</div>`) : requireLoginText()}
    </section>
  `;
}

function renderOrderCard(order) {
  return `
    <article class="item-card">
      <div class="panel-head">
        <div><h3>${escapeHtml(order.service)}</h3><p class="muted">${escapeHtml(order.date)} ${escapeHtml(order.time)}｜${escapeHtml(order.area)}</p></div>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>
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
  const options = state.orders.map(order => `<option value="${order.id}">${escapeHtml(order.childName)} - ${escapeHtml(order.providerName)} - ${escapeHtml(order.service)}</option>`).join("");
  $("#messagesView").innerHTML = `
    <section class="panel">
      <div class="panel-head"><div><h2>订单消息</h2><p>家长和陪伴者围绕订单沟通。</p></div></div>
      ${state.user && state.orders.length ? `
        <form id="messageForm" class="form-grid">
          <div class="field full"><label>选择订单</label><select name="orderId">${options}</select></div>
          <div class="field full"><label>消息内容</label><textarea name="text" required></textarea></div>
          <div class="field full"><button class="primary-btn" type="submit">发送消息</button></div>
        </form>
        <div class="divider"></div>
        <div class="message-list">
          ${state.messages.length ? state.messages.map(message => `
            <div class="message ${message.senderRole === state.user.role ? "mine" : ""}">
              <p>${escapeHtml(message.text)}</p>
              <small>${message.senderRole === "system" ? "系统" : message.senderRole === "parent" ? "家长" : "陪伴者"} · ${new Date(message.createdAt).toLocaleString("zh-CN")}</small>
            </div>
          `).join("") : `<div class="empty">暂无消息。</div>`}
        </div>
      ` : `<div class="empty">登录并创建订单后即可发送消息。</div>`}
    </section>
  `;
}

function render() {
  renderStats();
  renderAuth();
  $all(".role-btn[data-role]").forEach(btn => btn.classList.toggle("active", btn.dataset.role === state.role));
  $all(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));
  $all(".view").forEach(view => view.classList.remove("active"));
  $(`#${state.view}View`)?.classList.add("active");
  renderDashboard();
  renderRequests();
  renderProviders();
  renderOrders();
  renderMessages();
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
  if (action === "clear-request-search") {
    const input = $("#requestSearchInput");
    if (input) input.value = "";
    $all(".request-list-item").forEach(item => item.hidden = false);
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
    state.view = viewBtn.dataset.view;
    render();
  }

  const actionBtn = event.target.closest("[data-action]");
  if (actionBtn) {
    try {
      await handleAction(actionBtn);
    } catch (error) {
      toast(error.message);
    }
  }
});

document.addEventListener("input", event => {
  if (event.target.id !== "requestSearchInput") return;
  const keyword = event.target.value.trim().toLowerCase();
  $all(".request-list-item").forEach(item => {
    item.hidden = keyword && !item.textContent.toLowerCase().includes(keyword);
  });
});

document.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    if (event.target.id === "loginForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      const result = await api("/api/auth/login", { method: "POST", body: data });
      localStorage.setItem(TOKEN_KEY, result.token);
      toast("登录成功");
      await refresh();
    }
    if (event.target.id === "registerForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      const result = await api("/api/auth/register", { method: "POST", body: data });
      localStorage.setItem(TOKEN_KEY, result.token);
      toast("注册成功");
      await refresh();
    }
    if (event.target.id === "requestForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api("/api/requests", { method: "POST", body: data });
      state.view = "requests";
      toast("需求已发布");
      await refresh();
    }
    if (event.target.id === "childForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api("/api/children", {
        method: "POST",
        body: {
          ...data,
          interests: data.interests.split(/[，,]/).map(item => item.trim()).filter(Boolean)
        }
      });
      event.target.reset();
      toast("孩子档案已保存");
      await refresh();
    }
    if (event.target.id === "providerForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api("/api/providers/me", {
        method: "PUT",
        body: {
          ...data,
          skills: data.skills.split(/[，,]/).map(item => item.trim()).filter(Boolean)
        }
      });
      toast("陪伴者主页已保存");
      await refresh();
    }
    if (event.target.id === "verificationForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api("/api/providers/me/verification", { method: "POST", body: data });
      event.target.reset();
      toast("认证申请已提交，等待审核");
      await refresh();
    }
    if (event.target.dataset.form === "report") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api(`/api/orders/${event.target.dataset.order}/report`, { method: "POST", body: data });
      toast("陪伴记录已保存");
      await refresh();
    }
    if (event.target.dataset.form === "review") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api(`/api/orders/${event.target.dataset.order}/review`, { method: "POST", body: data });
      toast("评价已提交");
      await refresh();
    }
    if (event.target.id === "messageForm") {
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api("/api/messages", { method: "POST", body: data });
      event.target.reset();
      toast("消息已发送");
      await refresh();
    }
  } catch (error) {
    toast(error.message);
  }
});

refresh();
