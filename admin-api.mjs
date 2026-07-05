import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.resolve(rootDir, "../backend/.env");

function parseEnvFile(filePath) {
  const env = {};
  const raw = readFileSync(filePath, "utf8");

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[match[1]] = value;
  });

  return env;
}

function normalizeSupabaseUrl(value, projectId) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (projectId) return `https://${projectId}.supabase.co`;
  return "";
}

function getSupabaseConfig() {
  const env = parseEnvFile(backendEnvPath);
  const url = normalizeSupabaseUrl(env.SUPABASE_URL, env.SUPABASE_PROJECT_ID);
  const key = String(env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) {
    throw new Error("Supabase server settings are missing in backend/.env.");
  }

  if (url.includes("YOUR_") || key.includes("YOUR_")) {
    throw new Error("Supabase server settings still contain placeholder values.");
  }

  return { url, key };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Import JSON is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    req.on("error", reject);
  });
}

async function readSupabaseError(response) {
  const raw = await response.text();
  if (!raw) return response.statusText;

  try {
    const parsed = JSON.parse(raw);
    return [parsed.message, parsed.details, parsed.hint, parsed.code]
      .filter(Boolean)
      .join(" ");
  } catch {
    return raw;
  }
}

async function upsertSupabaseRow(config, table, payload, onConflict, select) {
  const search = new URLSearchParams({
    on_conflict: onConflict,
    select,
  });

  const response = await fetch(`${config.url}/rest/v1/${table}?${search.toString()}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${table} upsert failed: ${await readSupabaseError(response)}`);
  }

  const result = await response.json();
  if (Array.isArray(result) && result.length) return result[0];
  if (result && typeof result === "object" && !Array.isArray(result)) return result;

  throw new Error(`Supabase returned no row for ${table}.`);
}

function text(value) {
  return String(value || "").trim();
}

async function importAcademicData(universities) {
  if (!Array.isArray(universities)) {
    throw new Error("JSON must be an array.");
  }

  const config = getSupabaseConfig();
  const summary = {
    universities: 0,
    branches: 0,
    subjects: 0,
  };
  const subjects = [];

  for (const university of universities) {
    const universityName = text(university.university_name);
    if (!universityName) throw new Error("university_name is required.");

    const universityRow = await upsertSupabaseRow(
      config,
      "universities",
      { university_name: universityName },
      "university_name",
      "university_id,university_name",
    );
    summary.universities += 1;

    for (const branch of university.branches || []) {
      const branchName = text(branch.branch_name);
      if (!branchName) throw new Error("branch_name is required.");

      const branchRow = await upsertSupabaseRow(
        config,
        "branches",
        {
          university_id: universityRow.university_id,
          branch_name: branchName,
          branch_code: text(branch.branch_code) || null,
        },
        "university_id,branch_name",
        "branch_id,branch_name,branch_code,university_id",
      );
      summary.branches += 1;

      for (const semesterBlock of branch.semesters || []) {
        const semester = Number(semesterBlock.semester);
        if (!semester) throw new Error("semester is required.");

        for (const subject of semesterBlock.subjects || []) {
          const subjectName = text(subject.subject_name);
          const subjectCode = text(subject.subject_code);
          if (!subjectName || !subjectCode) {
            throw new Error("subject_name and subject_code are required.");
          }

          const subjectRow = await upsertSupabaseRow(
            config,
            "subjects",
            {
              university_id: universityRow.university_id,
              branch_id: branchRow.branch_id,
              semester,
              subject_name: subjectName,
              subject_code: subjectCode,
            },
            "university_id,branch_id,semester,subject_code",
            "subject_id,subject_name,subject_code,semester,branch_id,university_id",
          );

          summary.subjects += 1;
          subjects.push({
            ...subjectRow,
            branch_name: branchRow.branch_name,
            university_name: universityRow.university_name,
          });
        }
      }
    }
  }

  return { summary, subjects };
}

export function academicImportMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url || "", "http://localhost");

    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Vary", "Origin");

    if (url.pathname !== "/admin-api/academic-import") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 200, { success: true });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const universities = Array.isArray(body) ? body : body.universities;
      const result = await importAcademicData(universities);

      sendJson(res, 200, {
        success: true,
        ...result,
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  };
}
