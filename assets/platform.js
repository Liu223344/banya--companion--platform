const STORAGE_KEY = "banya-platform-mvp-v1";

const seedData = {
  role: "parent",
  view: "dashboard",
  parent: {
    name: "试用家长",
    phone: "13800000000",
    address: "绿芽小区"
  },
  providerProfile: {
    name: "我的陪伴者主页",
    type: "师范生",
    distance: "1.0km",
    price: 78,
    skills: ["作业引导", "阅读陪伴"],
    bio: "热爱儿童教育，下午和周末可接单。",
    verified: false
  },
  providers: [
    {
      id: "p1",
      name: "林老师",
      type: "退休小学教师",
      distance: "1.2km",
      price: 88,
      rating: 4.9,
      orders: 126,
      skills: ["阅读陪伴", "作业引导", "情绪陪聊"],
      bio: "30年小学教学经验，擅长低年级阅读启蒙和习惯培养。",
      verified: true
    },
    {
      id: "p2",
      name: "陈同学",
      type: "师范大学生",
      distance: "800m",
      price: 68,
      rating: 4.8,
      orders: 54,
      skills: ["户外运动", "手工创作", "儿童社交"],
      bio: "学前教育专业，下午没课时间稳定，喜欢带孩子做手工和户外游戏。",
      verified: true
    },
    {
      id: "p3",
      name: "周阿姨",
      type: "培训全职妈妈",
      distance: "2.4km",
      price: 72,
      rating: 4.7,
      orders: 83,
      skills: ["晚饭照看", "生活陪伴", "安全接送"],
      bio: "熟悉社区路线，耐心细致，可做放学接送和晚饭前陪伴。",
      verified: true
    }
  ],
  requests: [
    {
      id: "r1",
      parentName: "王女士",
      childName: "小雨",
      age: 7,
      area: "绿芽小区",
      date: "今天",
      time: "15:40-18:30",
      service: "放学接送 + 阅读陪伴",
      budget: 90,
      note: "孩子一年级，比较慢热，希望陪伴者有耐心，能引导阅读和完成简单作业。",
      status: "open",
      createdAt: Date.now() - 3600000
    }
  ],
  orders: [],
  messages: []
};

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedData);
  try {
    return { ...structuredClone(seedData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(seedData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function statusLabel(status) {
  const map = {
    open: "待匹配",
    matched: "已匹配",
    accepted: "已接单",
    arrived: "陪伴中",
    done: "已完成"
  };
  return map[status] || status;
}

function setView(view) {
  state.view = view;
  saveState();
  render();
  window.location.hash = view;
}

function setRole(role) {
  state.role = role;
  state.view = "dashboard";
  saveState();
  render();
  toast(role === "parent" ? "已切换到家长端" : "已切换到陪伴者端");
}

function providerPool() {
  const profile = state.providerProfile;
  const mine = {
    id: "mine",
    name: profile.name || "我的陪伴者主页",
    type: profile.type || "陪伴者",
    distance: profile.distance || "附近",
    price: Number(profile.price || 0),
    rating: profile.verified ? 4.6 : 0,
    orders: 0,
    skills: profile.skills || [],
    bio: profile.bio || "还没有填写简介。",
    verified: profile.verified
  };
  return [mine, ...state.providers];
}

function bestProvidersFor(request) {
  const serviceText = `${request.service} ${request.note}`;
  return providerPool()
    .map(provider => {
      const score = provider.skills.reduce((total, skill) => total + (serviceText.includes(skill.slice(0, 2)) ? 2 : 0), 0)
        + (provider.verified ? 2 : 0)
        + Math.max(0, 3 - Number.parseFloat(provider.distance || "3"));
      return { ...provider, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function createOrder(requestId, providerId) {
  const request = state.requests.find(item => item.id === requestId);
  const provider = providerPool().find(item => item.id === providerId);
  if (!request || !provider) return;
  if (request.status !== "open") {
    toast("这个需求已经被接单了");
    return;
  }
  request.status = "accepted";
  const order = {
    id: uid("o"),
    requestId,
    providerId,
    parentName: request.parentName,
    childName: request.childName,
    providerName: provider.name,
    service: request.service,
    area: request.area,
    date: request.date,
    time: request.time,
    price: request.budget || provider.price,
    status: "accepted",
    createdAt: Date.now(),
    feedback: ""
  };
  state.orders.unshift(order);
  state.messages.unshift({
    id: uid("m"),
    orderId: order.id,
    sender: "system",
    text: `订单已创建：${provider.name} 将为 ${request.childName} 提供「${request.service}」。`,
    createdAt: Date.now()
  });
  saveState();
  render();
  toast("接单成功，订单已生成");
}

function cardTags(tags) {
  return `<div class="tag-row">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderStats() {
  $("#statRequests").textContent = state.requests.length;
  $("#statProviders").textContent = providerPool().length;
  $("#statOrders").textContent = state.orders.filter(order => order.status !== "done").length;
  $("#statMessages").textContent = state.messages.length;
  $("#todayText").textContent = new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const latest = state.requests.find(item => item.status === "open");
  $("#phoneRecommend").textContent = latest
    ? `最新需求：${latest.area}，${latest.time}，需要${latest.service}。`
    : "暂无待匹配需求，可以先发布一个陪伴需求。";
}

function renderDashboard() {
  const root = $("#dashboardView");
  if (state.role === "parent") {
    const openRequests = state.requests.filter(item => item.status === "open");
    root.innerHTML = `
      <section class="panel" id="createRequestPanel">
        <div class="panel-head">
          <div>
            <h2>发布陪伴需求</h2>
            <p>填写孩子情况、时间地点和陪伴目标，平台会给出推荐陪伴者。</p>
          </div>
          <button class="ghost-btn" data-action="fill-demo-request">填入示例</button>
        </div>
        <form id="requestForm" class="form-grid">
          <div class="field">
            <label>家长称呼</label>
            <input name="parentName" value="${escapeHtml(state.parent.name)}" required>
          </div>
          <div class="field">
            <label>孩子昵称</label>
            <input name="childName" placeholder="例如：小雨" required>
          </div>
          <div class="field">
            <label>孩子年龄</label>
            <input name="age" type="number" min="3" max="14" placeholder="7" required>
          </div>
          <div class="field">
            <label>服务地点</label>
            <input name="area" value="${escapeHtml(state.parent.address)}" required>
          </div>
          <div class="field">
            <label>服务日期</label>
            <input name="date" placeholder="今天 / 周五 / 2026-06-20" required>
          </div>
          <div class="field">
            <label>服务时间</label>
            <input name="time" placeholder="15:40-18:30" required>
          </div>
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
          <div class="field">
            <label>预算/小时</label>
            <input name="budget" type="number" min="1" value="80" required>
          </div>
          <div class="field full">
            <label>补充说明</label>
            <textarea name="note" placeholder="孩子性格、注意事项、希望陪伴者做什么" required></textarea>
          </div>
          <div class="field full">
            <button class="primary-btn" type="submit">发布需求并生成推荐</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>待匹配需求</h2>
            <p>你可以为任意待匹配需求选择陪伴者，模拟完成下单流程。</p>
          </div>
          <button class="ghost-btn" data-view="requests">进入需求广场</button>
        </div>
        ${openRequests.length ? renderRequestGrid(openRequests, true) : `<div class="empty">还没有待匹配需求，先发布一个吧。</div>`}
      </section>
    `;
  } else {
    root.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>完善陪伴者主页</h2>
            <p>上线正式版时这里会接入实名认证、资质审核和培训测评。</p>
          </div>
          <span class="status ${state.providerProfile.verified ? "open" : "matched"}">${state.providerProfile.verified ? "已模拟认证" : "未认证"}</span>
        </div>
        <form id="providerForm" class="form-grid">
          <div class="field">
            <label>姓名/昵称</label>
            <input name="name" value="${escapeHtml(state.providerProfile.name)}" required>
          </div>
          <div class="field">
            <label>身份类型</label>
            <select name="type">
              ${["师范生", "退休教师", "培训全职妈妈", "文艺工作者", "运动教练"].map(type => `<option ${state.providerProfile.type === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>服务距离</label>
            <input name="distance" value="${escapeHtml(state.providerProfile.distance)}" required>
          </div>
          <div class="field">
            <label>期望时薪</label>
            <input name="price" type="number" value="${escapeHtml(state.providerProfile.price)}" required>
          </div>
          <div class="field full">
            <label>技能标签，用逗号分隔</label>
            <input name="skills" value="${escapeHtml(state.providerProfile.skills.join("，"))}" required>
          </div>
          <div class="field full">
            <label>个人简介</label>
            <textarea name="bio" required>${escapeHtml(state.providerProfile.bio)}</textarea>
          </div>
          <div class="field full">
            <button class="primary-btn" type="submit">保存主页</button>
            <button class="ghost-btn" type="button" data-action="verify-provider">模拟完成认证</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>附近可接需求</h2>
            <p>陪伴者可以浏览需求并接单。</p>
          </div>
          <button class="ghost-btn" data-view="requests">查看全部需求</button>
        </div>
        ${renderRequestGrid(state.requests.filter(item => item.status === "open"), false)}
      </section>
    `;
  }
}

function renderRequestGrid(requests, withRecommendations) {
  if (!requests.length) return `<div class="empty">暂无待匹配需求。</div>`;
  return `<div class="grid cols-2">${requests.map(request => renderRequestCard(request, withRecommendations)).join("")}</div>`;
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
      ${cardTags([request.service, `预算 ${request.budget} 元/小时`])}
      <p>${escapeHtml(request.note)}</p>
      ${withRecommendations ? `
        <div class="divider"></div>
        <h3>推荐陪伴者</h3>
        <div class="grid">
          ${recommendations.map(provider => `
            <div class="item-card">
              <h3>${escapeHtml(provider.name)} <span class="muted">· ${escapeHtml(provider.type)}</span></h3>
              <p class="muted">${escapeHtml(provider.distance)}｜${provider.price} 元/小时｜${provider.verified ? "已认证" : "待认证"}</p>
              ${cardTags(provider.skills)}
              <button class="primary-btn" data-action="book" data-request="${request.id}" data-provider="${provider.id}">选择并下单</button>
            </div>
          `).join("")}
        </div>
      ` : `
        <div class="card-actions">
          <button class="primary-btn" data-action="accept-request" data-request="${request.id}">我要接单</button>
        </div>
      `}
    </article>
  `;
}

function renderRequests() {
  $("#requestsView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>需求广场</h2>
          <p>这里展示家长发布的真实陪伴需求。家长可匹配陪伴者，陪伴者可主动接单。</p>
        </div>
        <div class="filters">
          <button class="small-btn" data-filter="all">全部</button>
          <button class="small-btn" data-filter="open">待匹配</button>
          <button class="small-btn" data-filter="accepted">已接单</button>
        </div>
      </div>
      <div id="requestList">${renderRequestGrid(state.requests, state.role === "parent")}</div>
    </section>
  `;
}

function renderProviders() {
  $("#providersView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>陪伴者列表</h2>
          <p>家长可以查看陪伴者主页，按能力、距离、价格和认证状态选择合适人选。</p>
        </div>
        <button class="ghost-btn" data-action="reset-demo">重置演示数据</button>
      </div>
      <div class="grid cols-3">
        ${providerPool().map(provider => `
          <article class="item-card ${provider.id === "mine" ? "highlight" : ""}">
            <div class="panel-head">
              <div>
                <h3>${escapeHtml(provider.name)}</h3>
                <p class="muted">${escapeHtml(provider.type)}｜${escapeHtml(provider.distance)}</p>
              </div>
              <span class="status ${provider.verified ? "open" : "matched"}">${provider.verified ? "已认证" : "待认证"}</span>
            </div>
            ${cardTags(provider.skills)}
            <p>${escapeHtml(provider.bio)}</p>
            <p class="muted">评分：${provider.rating || "暂无"}｜服务：${provider.orders || 0} 单｜${provider.price || 0} 元/小时</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOrders() {
  $("#ordersView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>订单管理</h2>
          <p>订单状态支持：已接单、陪伴中、已完成。正式版可接入支付、保险和位置同步。</p>
        </div>
      </div>
      ${state.orders.length ? `<div class="grid cols-2">${state.orders.map(renderOrderCard).join("")}</div>` : `<div class="empty">暂无订单。家长可先发布需求，陪伴者可先接单。</div>`}
    </section>
  `;
}

function renderOrderCard(order) {
  return `
    <article class="item-card">
      <div class="panel-head">
        <div>
          <h3>${escapeHtml(order.service)}</h3>
          <p class="muted">${escapeHtml(order.date)} ${escapeHtml(order.time)}｜${escapeHtml(order.area)}</p>
        </div>
        <span class="status ${order.status}">${statusLabel(order.status)}</span>
      </div>
      <p><strong>孩子：</strong>${escapeHtml(order.childName)}　<strong>陪伴者：</strong>${escapeHtml(order.providerName)}</p>
      <p class="muted">订单金额参考：${escapeHtml(order.price)} 元/小时</p>
      ${order.feedback ? `<p><strong>陪伴反馈：</strong>${escapeHtml(order.feedback)}</p>` : ""}
      <div class="card-actions">
        ${order.status === "accepted" ? `<button class="primary-btn" data-action="order-arrived" data-order="${order.id}">开始陪伴</button>` : ""}
        ${order.status === "arrived" ? `<button class="primary-btn" data-action="order-done" data-order="${order.id}">完成订单</button>` : ""}
        <button class="ghost-btn" data-view="messages">去沟通</button>
      </div>
    </article>
  `;
}

function renderMessages() {
  const orderOptions = state.orders.map(order => `<option value="${order.id}">${escapeHtml(order.childName)} - ${escapeHtml(order.providerName)} - ${escapeHtml(order.service)}</option>`).join("");
  $("#messagesView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>订单消息</h2>
          <p>用于家长与陪伴者沟通接送地点、孩子状态和陪伴反馈。当前为本地模拟消息。</p>
        </div>
      </div>
      ${state.orders.length ? `
        <form id="messageForm" class="form-grid">
          <div class="field full">
            <label>选择订单</label>
            <select name="orderId">${orderOptions}</select>
          </div>
          <div class="field full">
            <label>消息内容</label>
            <textarea name="text" placeholder="例如：今天孩子有点咳嗽，户外活动时间可以短一点。" required></textarea>
          </div>
          <div class="field full">
            <button class="primary-btn" type="submit">发送消息</button>
          </div>
        </form>
        <div class="divider"></div>
        <div class="message-list">
          ${state.messages.length ? state.messages.map(message => `
            <div class="message ${message.sender === state.role ? "mine" : ""}">
              <p>${escapeHtml(message.text)}</p>
              <small>${message.sender === "system" ? "系统" : message.sender === "parent" ? "家长" : "陪伴者"} · ${new Date(message.createdAt).toLocaleString("zh-CN")}</small>
            </div>
          `).join("") : `<div class="empty">暂无消息。</div>`}
        </div>
      ` : `<div class="empty">还没有订单，创建订单后即可发送消息。</div>`}
    </section>
  `;
}

function render() {
  renderStats();
  $all(".role-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.role === state.role));
  $all(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));
  $all(".view").forEach(view => view.classList.remove("active"));
  $(`#${state.view}View`)?.classList.add("active");
  renderDashboard();
  renderRequests();
  renderProviders();
  renderOrders();
  renderMessages();
}

document.addEventListener("click", event => {
  const roleBtn = event.target.closest("[data-role]");
  if (roleBtn) setRole(roleBtn.dataset.role);

  const viewBtn = event.target.closest("[data-view]");
  if (viewBtn) setView(viewBtn.dataset.view);

  const actionBtn = event.target.closest("[data-action]");
  if (!actionBtn) return;
  const action = actionBtn.dataset.action;

  if (action === "scroll-create") {
    setRole("parent");
    window.setTimeout(() => $("#createRequestPanel")?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  if (action === "fill-demo-request") {
    const form = $("#requestForm");
    if (!form) return;
    form.childName.value = "小芽";
    form.age.value = 8;
    form.area.value = "阳光花园";
    form.date.value = "今天";
    form.time.value = "15:50-18:20";
    form.service.value = "作业引导 + 情绪陪聊";
    form.budget.value = 85;
    form.note.value = "孩子最近放学后容易刷短视频，希望有人陪他先吃点东西，再完成作业和阅读。";
    toast("已填入示例需求");
  }

  if (action === "book") {
    createOrder(actionBtn.dataset.request, actionBtn.dataset.provider);
  }

  if (action === "accept-request") {
    createOrder(actionBtn.dataset.request, "mine");
  }

  if (action === "verify-provider") {
    state.providerProfile.verified = true;
    saveState();
    render();
    toast("已模拟完成认证");
  }

  if (action === "order-arrived" || action === "order-done") {
    const order = state.orders.find(item => item.id === actionBtn.dataset.order);
    if (!order) return;
    order.status = action === "order-arrived" ? "arrived" : "done";
    if (order.status === "done") {
      order.feedback = "本次陪伴已完成：孩子状态稳定，完成了计划活动，建议下次继续保持固定节奏。";
    }
    state.messages.unshift({
      id: uid("m"),
      orderId: order.id,
      sender: "system",
      text: `订单状态更新为：${statusLabel(order.status)}。`,
      createdAt: Date.now()
    });
    saveState();
    render();
    toast(statusLabel(order.status));
  }

  if (action === "reset-demo") {
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(seedData);
    saveState();
    render();
    toast("演示数据已重置");
  }
});

document.addEventListener("submit", event => {
  event.preventDefault();

  if (event.target.id === "requestForm") {
    const data = Object.fromEntries(new FormData(event.target).entries());
    const request = {
      id: uid("r"),
      parentName: data.parentName,
      childName: data.childName,
      age: Number(data.age),
      area: data.area,
      date: data.date,
      time: data.time,
      service: data.service,
      budget: Number(data.budget),
      note: data.note,
      status: "open",
      createdAt: Date.now()
    };
    state.parent.name = data.parentName;
    state.parent.address = data.area;
    state.requests.unshift(request);
    state.view = "requests";
    saveState();
    render();
    toast("需求已发布，已进入需求广场");
  }

  if (event.target.id === "providerForm") {
    const data = Object.fromEntries(new FormData(event.target).entries());
    state.providerProfile = {
      ...state.providerProfile,
      name: data.name,
      type: data.type,
      distance: data.distance,
      price: Number(data.price),
      skills: data.skills.split(/[，,]/).map(item => item.trim()).filter(Boolean),
      bio: data.bio
    };
    saveState();
    render();
    toast("陪伴者主页已保存");
  }

  if (event.target.id === "messageForm") {
    const data = Object.fromEntries(new FormData(event.target).entries());
    state.messages.unshift({
      id: uid("m"),
      orderId: data.orderId,
      sender: state.role,
      text: data.text,
      createdAt: Date.now()
    });
    event.target.reset();
    saveState();
    render();
    toast("消息已发送");
  }
});

window.addEventListener("hashchange", () => {
  const view = location.hash.replace("#", "");
  if (["dashboard", "requests", "providers", "orders", "messages"].includes(view)) {
    state.view = view;
    saveState();
    render();
  }
});

if (location.hash) {
  const view = location.hash.replace("#", "");
  if (["dashboard", "requests", "providers", "orders", "messages"].includes(view)) state.view = view;
}

render();
