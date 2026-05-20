export function nowIso() {
  return new Date().toISOString();
}

export function splitPath(pathname) {
  return pathname.split("/").filter(Boolean);
}

export function routeParams(pattern, pathname) {
  const expected = splitPath(pattern);
  const actual = splitPath(pathname);

  if (expected.length !== actual.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < expected.length; index += 1) {
    const patternPart = expected[index];
    const actualPart = decodeURIComponent(actual[index]);

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = actualPart;
      continue;
    }

    if (patternPart !== actualPart) {
      return null;
    }
  }

  return params;
}

export function pickQuery(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

export function includesText(value, expected) {
  if (!expected) {
    return true;
  }
  return String(value ?? "").toLowerCase().includes(String(expected).toLowerCase());
}

export function equalsIfPresent(value, expected) {
  if (expected === undefined || expected === null || expected === "") {
    return true;
  }
  return String(value) === String(expected);
}

export function paginate(items, query) {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize ?? "50", 10), 1), 200);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length
  };
}

export function buildId(prefix, counters) {
  const next = (counters[prefix] ?? 0) + 1;
  counters[prefix] = next;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted = {};
  for (const [key, item] of Object.entries(value)) {
    if (["phone", "idCardNo", "id_card_no", "address"].includes(key)) {
      redacted[key] = "***";
    } else {
      redacted[key] = redact(item);
    }
  }
  return redacted;
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });

    req.on("error", reject);
  });
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,x-correlation-id",
    ...extraHeaders
  };

  if (status === 204) {
    res.writeHead(status, headers);
    res.end();
    return;
  }

  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, headers);
  res.end(payload);
}

export function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,x-correlation-id"
  });
  res.end(body);
}

export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function requireFound(value, message) {
  if (!value) {
    throw new HttpError(404, message);
  }
  return value;
}
