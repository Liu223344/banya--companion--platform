const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon"
};

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(12).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  return hashPassword(password, salt) === stored;
}

function now() {
  return new Date().toISOString();
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function seedDb() {
  const parentId = "u_parent_demo";
  const providerUserId = "u_provider_demo";
  const providerId = "provider_demo";
  return {
    users: [
      {
        id: parentId,
        name: "试用家长",
        phone: "13800000000",
        role: "parent",
        area: "绿芽小区",
        passwordHash: hashPassword("123456"),
        createdAt: now()
      },
      {
        id: providerUserId,
        name: "林老师",
        phone: "13900000000",
        role: "provider",
        area: "绿芽小区",
        passwordHash: hashPassword("123456"),
        createdAt: now()
      }
    ],
    providers: [
      {
        id: providerId,
        userId: providerUserId,
        name: "林老师",
        type: "退休小学教师",
        distance: "1.2km",
        price: 88,
        rating: 4.9,
        orders: 126,
        skills: ["阅读陪伴", "作业引导", "情绪陪聊"],
        bio: "30年小学教学经验，擅长低年级阅读启蒙和习惯培养。",
        verified: true,
        createdAt: now()
      },
      {
        id: "provider_chen",
        userId: null,
        name: "陈同学",
        type: "师范大学生",
        distance: "800m",
        price: 68,
        rating: 4.8,
        orders: 54,
        skills: ["户外运动", "手工创作", "儿童社交"],
        bio: "学前教育专业，下午没课时间稳定，喜欢带孩子做手工和户外游戏。",
        verified: true,
        createdAt: now()
      }
    ],
    requests: [
      {
        id: "request_demo",
        parentId,
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
        createdAt: now()
      }
    ],
    children: [
      {
        id: "child_demo",
        parentId,
        name: "小雨",
        age: 7,
        gender: "女",
        interests: ["阅读", "画画"],
        notes: "慢热，熟悉后很愿意表达。放学后需要先吃点东西再写作业。",
        createdAt: now()
      }
    ],
    orders: [],
    messages: [],
    reviews: [],
    sessions: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(seedDb(), null, 2), "utf8");
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.children ||= [];
  db.reviews ||= [];
  db.providers ||= [];
  db.requests ||= [];
  db.orders ||= [];
  db.messages ||= [];
  db.sessions ||= [];
  db.providers.forEach(provider => {
    provider.verificationStatus ||= provider.verified ? "approved" : "none";
  });
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON 格式错误"));
      }
    });
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return "";
}

function getCurrentUser(req, db) {
  const token = getToken(req);
  const session = db.sessions.find(item => item.token === token);
  if (!session) return null;
  return db.users.find(user => user.id === session.userId) || null;
}

function requireUser(req, res, db) {
  const user = getCurrentUser(req, db);
  if (!user) {
    send(res, 401, { error: "请先登录" });
    return null;
  }
  return user;
}

function requireRole(user, role, res) {
  if (user.role !== role) {
    send(res, 403, { error: `当前账号不是${role === "parent" ? "家长" : "陪伴者"}身份` });
    return false;
  }
  return true;
}

function providerForUser(db, userId) {
  return db.providers.find(provider => provider.userId === userId);
}

function createOrder(db, request, provider) {
  const order = {
    id: id("order"),
    requestId: request.id,
    parentId: request.parentId,
    providerId: provider.id,
    parentName: request.parentName,
    childName: request.childName,
    providerName: provider.name,
    service: request.service,
    area: request.area,
    date: request.date,
    time: request.time,
    price: request.budget || provider.price,
    status: "accepted",
    feedback: "",
    createdAt: now()
  };
  request.status = "accepted";
  request.providerId = provider.id;
  provider.orders = Number(provider.orders || 0) + 1;
  db.orders.unshift(order);
  db.messages.unshift({
    id: id("msg"),
    orderId: order.id,
    senderId: "system",
    senderRole: "system",
    text: `订单已创建：${provider.name} 将为 ${request.childName} 提供「${request.service}」。`,
    createdAt: now()
  });
  return order;
}

async function handleApi(req, res, pathname) {
  const db = readDb();
  const method = req.method;

  if (method === "GET" && pathname === "/api/health") {
    return send(res, 200, { ok: true, message: "伴芽服务端运行中" });
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const role = body.role === "provider" ? "provider" : "parent";
    if (!name || !phone || password.length < 6) return send(res, 400, { error: "请填写姓名、手机号和至少6位密码" });
    if (db.users.some(user => user.phone === phone)) return send(res, 409, { error: "这个手机号已经注册" });
    const user = {
      id: id("user"),
      name,
      phone,
      role,
      area: String(body.area || ""),
      passwordHash: hashPassword(password),
      createdAt: now()
    };
    db.users.push(user);
    if (role === "provider") {
      db.providers.push({
        id: id("provider"),
        userId: user.id,
        name,
        type: "师范生",
        distance: "1.0km",
        price: 78,
        rating: 0,
        orders: 0,
        skills: ["阅读陪伴", "作业引导"],
        bio: "还没有填写简介。",
        verified: false,
        createdAt: now()
      });
    }
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions.push({ token, userId: user.id, createdAt: now() });
    writeDb(db);
    return send(res, 201, { token, user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const user = db.users.find(item => item.phone === String(body.phone || "").trim());
    if (!user || !verifyPassword(body.password, user.passwordHash)) return send(res, 401, { error: "手机号或密码不正确" });
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions.push({ token, userId: user.id, createdAt: now() });
    writeDb(db);
    return send(res, 200, { token, user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    const token = getToken(req);
    const next = db.sessions.filter(item => item.token !== token);
    db.sessions = next;
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (method === "PUT" && pathname === "/api/auth/profile") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const body = await parseBody(req);
    if (body.name) user.name = String(body.name).trim();
    if (body.phone) user.phone = String(body.phone).trim();
    if (body.area) user.area = String(body.area).trim();
    writeDb(db);
    return send(res, 200, { user: publicUser(user) });
  }

  if (method === "GET" && pathname === "/api/me") {
    const user = requireUser(req, res, db);
    if (!user) return;
    return send(res, 200, { user: publicUser(user), provider: providerForUser(db, user.id) || null });
  }

  if (method === "GET" && pathname === "/api/bootstrap") {
    const user = getCurrentUser(req, db);
    return send(res, 200, {
      user: publicUser(user),
      provider: user ? providerForUser(db, user.id) || null : null,
      providers: db.providers,
      requests: db.requests,
      children: user?.role === "parent" ? db.children.filter(child => child.parentId === user.id) : [],
      orders: user ? db.orders.filter(order => user.role === "parent" ? order.parentId === user.id : providerForUser(db, user.id)?.id === order.providerId) : [],
      messages: user ? db.messages : [],
      reviews: db.reviews
    });
  }

  if (method === "GET" && pathname === "/api/children") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "parent", res)) return;
    return send(res, 200, { children: db.children.filter(child => child.parentId === user.id) });
  }

  if (method === "POST" && pathname === "/api/children") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "parent", res)) return;
    const body = await parseBody(req);
    const child = {
      id: id("child"),
      parentId: user.id,
      name: String(body.name || "").trim(),
      age: Number(body.age || 0),
      gender: String(body.gender || "").trim(),
      interests: Array.isArray(body.interests) ? body.interests : String(body.interests || "").split(/[，,]/).map(item => item.trim()).filter(Boolean),
      notes: String(body.notes || "").trim(),
      createdAt: now()
    };
    if (!child.name || !child.age) return send(res, 400, { error: "请填写孩子姓名和年龄" });
    db.children.unshift(child);
    writeDb(db);
    return send(res, 201, { child });
  }

  if (method === "GET" && pathname === "/api/providers") {
    return send(res, 200, { providers: db.providers });
  }

  if (method === "PUT" && pathname === "/api/providers/me") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "provider", res)) return;
    const body = await parseBody(req);
    let provider = providerForUser(db, user.id);
    if (!provider) {
      provider = { id: id("provider"), userId: user.id, rating: 0, orders: 0, verified: false, createdAt: now() };
      db.providers.push(provider);
    }
    Object.assign(provider, {
      name: String(body.name || user.name),
      type: String(body.type || "陪伴者"),
      distance: String(body.distance || "1.0km"),
      price: Number(body.price || 0),
      skills: Array.isArray(body.skills) ? body.skills : String(body.skills || "").split(/[，,]/).map(item => item.trim()).filter(Boolean),
      bio: String(body.bio || "")
    });
    writeDb(db);
    return send(res, 200, { provider });
  }

  if (method === "POST" && pathname === "/api/providers/me/verify") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "provider", res)) return;
    const provider = providerForUser(db, user.id);
    if (!provider) return send(res, 404, { error: "请先完善陪伴者主页" });
    provider.verified = true;
    provider.verificationStatus = "approved";
    writeDb(db);
    return send(res, 200, { provider });
  }

  if (method === "POST" && pathname === "/api/providers/me/verification") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "provider", res)) return;
    const body = await parseBody(req);
    const provider = providerForUser(db, user.id);
    if (!provider) return send(res, 404, { error: "请先完善陪伴者主页" });
    provider.verificationStatus = "pending";
    provider.verification = {
      realName: String(body.realName || provider.name).trim(),
      credentialType: String(body.credentialType || "").trim(),
      credentialNoMasked: String(body.credentialNo || "").replace(/^(.{2}).*(.{2})$/, "$1****$2"),
      experience: String(body.experience || "").trim(),
      submittedAt: now()
    };
    writeDb(db);
    return send(res, 200, { provider });
  }

  if (method === "GET" && pathname === "/api/requests") {
    return send(res, 200, { requests: db.requests });
  }

  if (method === "POST" && pathname === "/api/requests") {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "parent", res)) return;
    const body = await parseBody(req);
    const request = {
      id: id("request"),
      parentId: user.id,
      parentName: user.name,
      childName: String(body.childName || "").trim(),
      age: Number(body.age || 0),
      area: String(body.area || user.area || "").trim(),
      date: String(body.date || "").trim(),
      time: String(body.time || "").trim(),
      service: String(body.service || "").trim(),
      budget: Number(body.budget || 0),
      note: String(body.note || "").trim(),
      status: "open",
      createdAt: now()
    };
    if (!request.childName || !request.age || !request.area || !request.date || !request.time || !request.service) {
      return send(res, 400, { error: "请补全陪伴需求信息" });
    }
    db.requests.unshift(request);
    writeDb(db);
    return send(res, 201, { request });
  }

  const bookMatch = pathname.match(/^\/api\/requests\/([^/]+)\/book$/);
  if (method === "POST" && bookMatch) {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "parent", res)) return;
    const body = await parseBody(req);
    const request = db.requests.find(item => item.id === bookMatch[1]);
    const provider = db.providers.find(item => item.id === body.providerId);
    if (!request || !provider) return send(res, 404, { error: "需求或陪伴者不存在" });
    if (request.status !== "open") return send(res, 409, { error: "这个需求已经被接单" });
    const order = createOrder(db, request, provider);
    writeDb(db);
    return send(res, 201, { order });
  }

  const acceptMatch = pathname.match(/^\/api\/requests\/([^/]+)\/accept$/);
  if (method === "POST" && acceptMatch) {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "provider", res)) return;
    const provider = providerForUser(db, user.id);
    const request = db.requests.find(item => item.id === acceptMatch[1]);
    if (!provider) return send(res, 404, { error: "请先完善陪伴者主页" });
    if (!request) return send(res, 404, { error: "需求不存在" });
    if (request.status !== "open") return send(res, 409, { error: "这个需求已经被接单" });
    const order = createOrder(db, request, provider);
    writeDb(db);
    return send(res, 201, { order });
  }

  if (method === "GET" && pathname === "/api/orders") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const provider = providerForUser(db, user.id);
    const orders = db.orders.filter(order => user.role === "parent" ? order.parentId === user.id : provider?.id === order.providerId);
    return send(res, 200, { orders });
  }

  const orderStatusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (method === "PATCH" && orderStatusMatch) {
    const user = requireUser(req, res, db);
    if (!user) return;
    const body = await parseBody(req);
    const order = db.orders.find(item => item.id === orderStatusMatch[1]);
    const provider = providerForUser(db, user.id);
    if (!order) return send(res, 404, { error: "订单不存在" });
    const canEdit = user.role === "parent" ? order.parentId === user.id : provider?.id === order.providerId;
    if (!canEdit) return send(res, 403, { error: "不能操作这个订单" });
    if (!["accepted", "arrived", "done"].includes(body.status)) return send(res, 400, { error: "订单状态不正确" });
    order.status = body.status;
    if (body.status === "done") order.feedback = body.feedback || "本次陪伴已完成，孩子状态稳定。";
    db.messages.unshift({
      id: id("msg"),
      orderId: order.id,
      senderId: "system",
      senderRole: "system",
      text: `订单状态更新为：${body.status === "arrived" ? "陪伴中" : body.status === "done" ? "已完成" : "已接单"}。`,
      createdAt: now()
    });
    writeDb(db);
    return send(res, 200, { order });
  }

  const orderReportMatch = pathname.match(/^\/api\/orders\/([^/]+)\/report$/);
  if (method === "POST" && orderReportMatch) {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "provider", res)) return;
    const provider = providerForUser(db, user.id);
    const order = db.orders.find(item => item.id === orderReportMatch[1]);
    if (!order) return send(res, 404, { error: "订单不存在" });
    if (provider?.id !== order.providerId) return send(res, 403, { error: "不能填写这个订单的陪伴记录" });
    const body = await parseBody(req);
    order.report = {
      activities: String(body.activities || "").trim(),
      mood: String(body.mood || "").trim(),
      homework: String(body.homework || "").trim(),
      suggestion: String(body.suggestion || "").trim(),
      createdAt: now()
    };
    if (!order.report.activities) return send(res, 400, { error: "请填写陪伴活动记录" });
    db.messages.unshift({
      id: id("msg"),
      orderId: order.id,
      senderId: "system",
      senderRole: "system",
      text: `${provider.name} 已提交本次陪伴记录。`,
      createdAt: now()
    });
    writeDb(db);
    return send(res, 200, { order });
  }

  const orderReviewMatch = pathname.match(/^\/api\/orders\/([^/]+)\/review$/);
  if (method === "POST" && orderReviewMatch) {
    const user = requireUser(req, res, db);
    if (!user || !requireRole(user, "parent", res)) return;
    const order = db.orders.find(item => item.id === orderReviewMatch[1]);
    if (!order) return send(res, 404, { error: "订单不存在" });
    if (order.parentId !== user.id) return send(res, 403, { error: "不能评价这个订单" });
    if (order.status !== "done") return send(res, 400, { error: "订单完成后才能评价" });
    const body = await parseBody(req);
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    const review = {
      id: id("review"),
      orderId: order.id,
      providerId: order.providerId,
      parentId: user.id,
      rating,
      text: String(body.text || "").trim(),
      createdAt: now()
    };
    const existing = db.reviews.find(item => item.orderId === order.id);
    if (existing) return send(res, 409, { error: "这个订单已经评价过" });
    db.reviews.unshift(review);
    order.review = review;
    const provider = db.providers.find(item => item.id === order.providerId);
    if (provider) {
      const providerReviews = db.reviews.filter(item => item.providerId === provider.id);
      provider.rating = Number((providerReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / providerReviews.length).toFixed(1));
    }
    writeDb(db);
    return send(res, 201, { review, order, provider });
  }

  if (method === "GET" && pathname === "/api/messages") {
    const user = requireUser(req, res, db);
    if (!user) return;
    return send(res, 200, { messages: db.messages });
  }

  if (method === "POST" && pathname === "/api/messages") {
    const user = requireUser(req, res, db);
    if (!user) return;
    const body = await parseBody(req);
    const order = db.orders.find(item => item.id === body.orderId);
    if (!order) return send(res, 404, { error: "订单不存在" });
    const message = {
      id: id("msg"),
      orderId: order.id,
      senderId: user.id,
      senderRole: user.role,
      text: String(body.text || "").trim(),
      createdAt: now()
    };
    if (!message.text) return send(res, 400, { error: "消息不能为空" });
    db.messages.unshift(message);
    writeDb(db);
    return send(res, 201, { message });
  }

  send(res, 404, { error: "接口不存在" });
}

function serveStatic(req, res, pathname) {
  const rawPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("文件不存在");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);
    serveStatic(req, res, url.pathname);
  } catch (error) {
    send(res, 500, { error: error.message || "服务器错误" });
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`伴芽平台已启动：http://localhost:${PORT}`);
  console.log("试用家长账号：13800000000 / 123456");
  console.log("试用陪伴者账号：13900000000 / 123456");
});
