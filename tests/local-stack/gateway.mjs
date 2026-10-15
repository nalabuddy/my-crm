// Local stand-in for Supabase's HTTP surface, for tests only:
//   /auth/v1/*  -> tiny password login (HS256 JWTs)      /rest/v1/* -> real PostgREST
import http from "node:http";
import crypto from "node:crypto";

const PORT = +process.env.GATEWAY_PORT || 54321;
const REST = { host: "127.0.0.1", port: +process.env.PGRST_SERVER_PORT || 3001 };
const SECRET = process.env.PGRST_JWT_SECRET;
const USERS = {
  "michaelvaneck11@gmail.com": { id: "11111111-1111-4111-8111-111111111111", password: "test-pass-michael" },
  "ryantrevor72@gmail.com": { id: "22222222-2222-4222-8222-222222222222", password: "test-pass-trevor" },
  "stranger@example.com": { id: "33333333-3333-4333-8333-333333333333", password: "test-pass-stranger" },
};
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (p) => { const d = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(p)}`; return `${d}.${crypto.createHmac("sha256", SECRET).update(d).digest("base64url")}`; };
function verify(t) {
  const [h, p, s] = (t || "").split(".");
  if (!s || crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") !== s) return null;
  const c = JSON.parse(Buffer.from(p, "base64url").toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const userObj = (email, id) => ({ id, aud: "authenticated", role: "authenticated", email, email_confirmed_at: "2026-01-01T00:00:00Z", phone: "",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
function session(email, id) {
  const iat = Math.floor(Date.now() / 1000), exp = iat + 3600;
  const access_token = sign({ aud: "authenticated", exp, iat, sub: id, email, role: "authenticated", aal: "aal1", session_id: crypto.randomUUID(), app_metadata: {}, user_metadata: {}, is_anonymous: false });
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: b64(`${email}|${Math.random()}`), user: userObj(email, id) };
}
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const b = JSON.parse((await body(req)).toString() || "{}");
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const email = Buffer.from(b.refresh_token || "", "base64url").toString().split("|")[0];
      return USERS[email] ? json(res, 200, session(email, USERS[email].id)) : json(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "bad refresh token" });
    }
    const u = USERS[(b.email || "").toLowerCase()];
    if (!u || u.password !== b.password) return json(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    return json(res, 200, session(b.email.toLowerCase(), u.id));
  }
  if (url.pathname === "/auth/v1/user") {
    const c = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
    return c ? json(res, 200, userObj(c.email, c.sub)) : json(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
  }
  if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  if (url.pathname.startsWith("/auth/v1/")) return json(res, 404, { msg: "not found" });

  if (url.pathname.startsWith("/rest/v1/")) {
    const data = await body(req);
    const headers = { ...req.headers, host: `${REST.host}:${REST.port}`, "content-length": data.length };
    delete headers.apikey; // a non-JWT publishable key is not valid for PostgREST
    const up = http.request({ ...REST, method: req.method, path: url.pathname.replace("/rest/v1", "") + url.search, headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on("error", (e) => json(res, 502, { msg: String(e) }));
    return up.end(data);
  }
  json(res, 404, { msg: "not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`gateway on :${PORT}`));
