export const APP_NAME = "Khata Connect";

export const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://sonal@localhost:5432/khata_connect";

export const IS_PROD = process.env.NODE_ENV === "production";

export const PORT = Number(process.env.PORT ?? 4400);

/** Rolling session length for opaque auth tokens (auths table + in-memory cache). */
export const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 30);

export const ALLOWED_ORIGIN_HOSTS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3400"
).split(",");

export const SMTP = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
};

/** OTP accepted for every flow outside production. */
export const DEV_OTP = "123456";

/** All dates are bucketed in this timezone. */
export const APP_TZ = "Asia/Kolkata";
