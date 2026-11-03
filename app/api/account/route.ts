import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Level = "foundation" | "intermediate" | "advanced";

type UserRow = {
  id: number;
  login_name: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  learning_data: string;
};

type SessionUserRow = UserRow & {
  expires_at: string;
};

type AccountRequest = {
  name?: unknown;
  password?: unknown;
  level?: unknown;
  initialData?: unknown;
};

type LearningData = Record<string, unknown>;

const SESSION_DAYS = 30;
const MAX_DATA_BYTES = 256 * 1024;
const LEVELS = new Set<Level>(["foundation", "intermediate", "advanced"]);

const globalDatabase = globalThis as typeof globalThis & {
  lifeEnglishDatabase?: DatabaseSync;
};

function databasePath() {
  const configured = process.env.LIFE_ENGLISH_DB_PATH?.trim();
  if (!configured) {
    return join(/* turbopackIgnore: true */ process.cwd(), "data", "life-english.sqlite");
  }
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function getDatabase() {
  if (globalDatabase.lifeEnglishDatabase) {
    return globalDatabase.lifeEnglishDatabase;
  }

  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      learning_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `);
  globalDatabase.lifeEnglishDatabase = database;
  return database;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function validName(name: string) {
  return name.length >= 1
    && name.length <= 32
    && !/[\u0000-\u001f\u007f]/.test(name);
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeLevel(value: unknown): Level {
  return typeof value === "string" && LEVELS.has(value as Level)
    ? value as Level
    : "intermediate";
}

function passwordDigest(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password: string, row: UserRow) {
  const actual = Buffer.from(passwordDigest(password, row.password_salt), "hex");
  const expected = Buffer.from(row.password_hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function defaultLearningData(name: string, level: Level): LearningData {
  return {
    registered: true,
    signedIn: true,
    name,
    level,
    xp: 0,
    streak: 0,
    lastCheckinDate: null,
    routeDays: { foundation: 0, intermediate: 0, advanced: 0 },
    routeCheckinDates: { foundation: null, intermediate: null, advanced: null },
    completedScenes: [],
    savedPhrases: [],
    watchedSeriesEpisodes: [],
    practicedSeriesEpisodes: [],
    roleplayedSeriesEpisodes: [],
    completedSeriesEpisodes: [],
    seriesBestScores: {},
  };
}

function normalizeLearningData(
  value: unknown,
  name: string,
  fallbackLevel: Level,
) {
  const base = defaultLearningData(name, fallbackLevel);
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;

  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_BYTES) {
    throw new Error("LEARNING_DATA_TOO_LARGE");
  }
  const safeValue = JSON.parse(serialized) as LearningData;
  return {
    ...base,
    ...safeValue,
    registered: true,
    name,
    level: normalizeLevel(safeValue.level ?? fallbackLevel),
  };
}

function parseLearningData(row: UserRow) {
  try {
    return normalizeLearningData(
      JSON.parse(row.learning_data) as unknown,
      row.display_name,
      "intermediate",
    );
  } catch {
    return defaultLearningData(row.display_name, "intermediate");
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createSession(database: DatabaseSync, userId: number) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token = randomBytes(32).toString("base64url");
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  database.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash(token), userId, now.toISOString(), expiresAt);
  return token;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;

  const database = getDatabase();
  const row = database.prepare(`
    SELECT
      users.id,
      users.login_name,
      users.display_name,
      users.password_salt,
      users.password_hash,
      users.learning_data,
      sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash(token)) as SessionUserRow | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  return row;
}

async function readBody(request: Request) {
  try {
    return await request.json() as AccountRequest;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return json({ code: "INVALID_JSON", message: "提交内容格式不正确。" }, 400);

  const name = normalizeName(body.name);
  const password = normalizePassword(body.password);
  const level = normalizeLevel(body.level);

  if (!validName(name)) {
    return json({ code: "INVALID_NAME", message: "登录名需为 1—32 个有效字符。" }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ code: "INVALID_PASSWORD", message: "密码需为 8—128 位。" }, 400);
  }

  const database = getDatabase();
  const existing = database.prepare(
    "SELECT * FROM users WHERE login_name = ?",
  ).get(name) as UserRow | undefined;

  if (existing) {
    if (!passwordMatches(password, existing)) {
      return json({ code: "WRONG_PASSWORD", message: "该登录名已存在，但密码不正确。" }, 401);
    }
    const token = createSession(database, existing.id);
    return json({
      ok: true,
      created: false,
      token,
      data: {
        ...parseLearningData(existing),
        signedIn: true,
      },
    });
  }

  let learningData: LearningData;
  try {
    learningData = normalizeLearningData(body.initialData, name, level);
  } catch {
    return json({ code: "DATA_TOO_LARGE", message: "学习档案数据过大，暂时无法同步。" }, 413);
  }
  learningData.signedIn = true;

  const salt = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  try {
    const result = database.prepare(`
      INSERT INTO users (
        login_name,
        display_name,
        password_salt,
        password_hash,
        learning_data,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      name,
      salt,
      passwordDigest(password, salt),
      JSON.stringify(learningData),
      now,
      now,
    );
    const userId = Number(result.lastInsertRowid);
    const token = createSession(database, userId);
    return json({ ok: true, created: true, token, data: learningData }, 201);
  } catch (error) {
    console.error("Account creation failed", error);
    return json({ code: "ACCOUNT_CREATE_FAILED", message: "账号创建失败，请稍后重试。" }, 500);
  }
}

export async function GET(request: Request) {
  const user = authenticatedUser(request);
  if (!user) return json({ code: "UNAUTHORIZED", message: "登录状态已失效，请重新登录。" }, 401);
  return json({ ok: true, data: parseLearningData(user) });
}

export async function PUT(request: Request) {
  const user = authenticatedUser(request);
  if (!user) return json({ code: "UNAUTHORIZED", message: "登录状态已失效，请重新登录。" }, 401);

  const body = await readBody(request);
  if (!body || !("initialData" in body)) {
    return json({ code: "INVALID_DATA", message: "缺少学习档案数据。" }, 400);
  }

  let learningData: LearningData;
  try {
    learningData = normalizeLearningData(
      body.initialData,
      user.display_name,
      normalizeLevel((body.initialData as LearningData | null)?.level),
    );
  } catch {
    return json({ code: "DATA_TOO_LARGE", message: "学习档案数据过大，暂时无法保存。" }, 413);
  }

  getDatabase().prepare(`
    UPDATE users
    SET learning_data = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(learningData), new Date().toISOString(), user.id);

  return json({ ok: true, savedAt: new Date().toISOString() });
}

export async function DELETE(request: Request) {
  const user = authenticatedUser(request);
  if (!user) return json({ code: "UNAUTHORIZED", message: "登录状态已失效，请重新登录。" }, 401);

  getDatabase().prepare("DELETE FROM users WHERE id = ?").run(user.id);
  return json({ ok: true });
}
