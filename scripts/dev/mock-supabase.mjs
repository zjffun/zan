#!/usr/bin/env node
// Minimal stand-in for Supabase's gateway, for running zan locally without
// Docker or a Supabase account:
//
//   /rest/v1/*  -> PostgREST (the same engine Supabase uses), unchanged
//   /auth/v1/*  -> just enough of GoTrue: password sign-up/sign-in, token
//                  refresh, /user, logout. Users are auto-confirmed.
//
// DEV ONLY. Passwords live in memory, there is no rate limiting, no e-mail,
// no OAuth. Never expose this to a network.

import http from "node:http";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? "http://127.0.0.1:3001";
const SECRET = process.env.JWT_SECRET ?? "zan-local-dev-secret-at-least-32-characters-long";
const DB_URL = process.env.DATABASE_URL ?? "postgres:///zan_dev";

const b64 = (input) => Buffer.from(input).toString("base64url");
function sign(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [head, body, sig] = (token ?? "").split(".");
  if (!sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}

const users = new Map(); // email -> { id, email, password }
const refreshTokens = new Map(); // token -> email

function userRow(user) {
  const now = new Date().toISOString();
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = sign({
    aud: "authenticated",
    role: "authenticated",
    sub: user.id,
    email: user.email,
    exp,
    iat: Math.floor(Date.now() / 1000),
    session_id: crypto.randomUUID(),
  });
  const refresh = crypto.randomBytes(16).toString("hex");
  refreshTokens.set(refresh, user.email);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userRow(user) };
}

function ensureUserInDb(user) {
  // the schema's foreign keys point at auth.users
  execFileSync("psql", [DB_URL, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", `id=${user.id}`, "-v", `email=${user.email}`], {
    input: "insert into auth.users (id, email) values (:'id', :'email') on conflict (id) do nothing;",
  });
}

function existingIdFromDb(email) {
  const out = execFileSync("psql", [DB_URL, "-X", "-q", "-t", "-A", "-v", `email=${email}`], {
    input: "select id from auth.users where email = :'email';",
  })
    .toString()
    .trim();
  return out || null;
}

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const gotrueError = (res, status, code, message) => json(res, status, { code: status, error_code: code, msg: message, message });

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function auth(req, res, url) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  const body = req.method === "POST" ? JSON.parse((await readBody(req)).toString() || "{}") : {};

  if (route === "/signup" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email) || String(body.password ?? "").length < 6) {
      return gotrueError(res, 422, "validation_failed", "invalid email or password");
    }
    if (users.has(email)) return gotrueError(res, 422, "user_already_exists", "User already registered");
    const user = { id: existingIdFromDb(email) ?? crypto.randomUUID(), email, password: String(body.password) };
    users.set(email, user);
    ensureUserInDb(user);
    return json(res, 200, session(user));
  }

  if (route === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const user = users.get(String(body.email ?? "").toLowerCase());
      if (!user || user.password !== body.password) return gotrueError(res, 400, "invalid_credentials", "Invalid login credentials");
      return json(res, 200, session(user));
    }
    if (grant === "refresh_token") {
      const email = refreshTokens.get(body.refresh_token);
      const user = email && users.get(email);
      if (!user) return gotrueError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(body.refresh_token);
      return json(res, 200, session(user));
    }
    return gotrueError(res, 400, "unsupported_grant_type", "only password and refresh_token are supported here");
  }

  if (route === "/user" && req.method === "GET") {
    const claims = verify((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
    const user = claims && [...users.values()].find((u) => u.id === claims.sub);
    return user ? json(res, 200, userRow(user)) : gotrueError(res, 401, "bad_jwt", "invalid JWT");
  }

  if (route === "/logout") {
    res.writeHead(204);
    return res.end();
  }
  if (route === "/otp") return json(res, 200, {});
  return gotrueError(res, 404, "not_found", `${req.method} ${route} is not implemented by the dev gateway`);
}

async function rest(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/rest\/v1/, "") + url.search, POSTGREST);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
  const upstream = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
  const out = {};
  upstream.headers.forEach((value, key) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(key)) out[key] = value;
  });
  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, url);
      json(res, 404, { message: "dev gateway: only /auth/v1 and /rest/v1" });
    } catch (error) {
      console.error(error);
      json(res, 500, { message: String(error) });
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    const now = Math.floor(Date.now() / 1000);
    const far = now + 10 * 365 * 86400;
    console.log(`dev gateway on http://127.0.0.1:${PORT}  ->  PostgREST ${POSTGREST}`);
    console.log(`SUPABASE_URL=http://127.0.0.1:${PORT}`);
    console.log(`SUPABASE_ANON_KEY=${sign({ role: "anon", iss: "zan-dev", iat: now, exp: far })}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "zan-dev", iat: now, exp: far })}`);
  });
