import { useState } from "react";

type FrontendEnv = {
  readonly VITE_ADMIN_API_BASE_URL?: string;
};

type SubjectInput = {
  subject_name: string;
  subject_code: string;
};

type SemesterInput = {
  semester: number;
  subjects: SubjectInput[];
};

type BranchInput = {
  branch_name: string;
  branch_code?: string;
  semesters: SemesterInput[];
};

type UniversityInput = {
  university_name: string;
  branches: BranchInput[];
};

type SubjectRow = {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  semester: number;
  branch_id: string;
  university_id: string;
};

export type ImportedSubject = SubjectRow & {
  branch_name: string;
  university_name: string;
};

type ImportSummary = {
  universities: number;
  branches: number;
  subjects: number;
};

type AcademicImportResponse = {
  success?: boolean;
  summary?: ImportSummary;
  subjects?: ImportedSubject[];
  error?: string;
  detail?: string;
};

type UniversityDataImportProps = {
  activeSubjectId?: string | null;
  onUseSubject?: (subject: ImportedSubject) => void;
};

const frontendEnv = (import.meta as unknown as { env?: FrontendEnv }).env;

const ADMIN_API_BASE_URL =
  frontendEnv?.VITE_ADMIN_API_BASE_URL || "/admin-api";

const sampleJson = JSON.stringify(
  [
    {
      university_name: "Example University",
      branches: [
        {
          branch_name: "Computer Science and Engineering",
          branch_code: "CSE",
          semesters: [
            {
              semester: 5,
              subjects: [
                {
                  subject_name: "Operating Systems",
                  subject_code: "CS501",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  null,
  2,
);

function parseAcademicJson(jsonText: string): UniversityInput[] {
  const data = JSON.parse(jsonText) as unknown;

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array.");
  }

  return data as UniversityInput[];
}

function validateAcademicData(data: UniversityInput[]) {
  if (!data.length) {
    throw new Error("At least one university is required.");
  }

  data.forEach((university, universityIndex) => {
    if (!university.university_name?.trim()) {
      throw new Error(`university_name is required at item ${universityIndex + 1}.`);
    }

    if (!Array.isArray(university.branches) || !university.branches.length) {
      throw new Error(`At least one branch is required at university ${universityIndex + 1}.`);
    }

    university.branches.forEach((branch, branchIndex) => {
      if (!branch.branch_name?.trim()) {
        throw new Error(
          `branch_name is required at university ${universityIndex + 1}, branch ${branchIndex + 1}.`,
        );
      }

      if (!Array.isArray(branch.semesters) || !branch.semesters.length) {
        throw new Error(
          `At least one semester block is required at university ${universityIndex + 1}, branch ${branchIndex + 1}.`,
        );
      }

      branch.semesters.forEach((semesterBlock, semesterIndex) => {
        if (!Number.isInteger(Number(semesterBlock.semester)) || Number(semesterBlock.semester) <= 0) {
          throw new Error(
            `Valid semester is required at university ${universityIndex + 1}, branch ${branchIndex + 1}, semester block ${semesterIndex + 1}.`,
          );
        }

        if (!Array.isArray(semesterBlock.subjects) || !semesterBlock.subjects.length) {
          throw new Error(
            `At least one subject is required at university ${universityIndex + 1}, branch ${branchIndex + 1}, semester ${semesterBlock.semester}.`,
          );
        }

        semesterBlock.subjects.forEach((subject, subjectIndex) => {
          if (!subject.subject_name?.trim() || !subject.subject_code?.trim()) {
            throw new Error(
              `subject_name and subject_code are required at university ${universityIndex + 1}, branch ${branchIndex + 1}, semester ${semesterBlock.semester}, subject ${subjectIndex + 1}.`,
            );
          }
        });
      });
    });
  });
}

function buildSubjectLabel(subject: ImportedSubject) {
  return [
    subject.subject_code,
    subject.subject_name,
    `Sem ${subject.semester}`,
    subject.branch_name,
    subject.university_name,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function readImportError(response: Response) {
  const raw = await response.text();
  if (!raw) return response.statusText || "Request failed.";

  try {
    const parsed = JSON.parse(raw) as AcademicImportResponse;
    return parsed.error || parsed.detail || raw;
  } catch {
    return raw;
  }
}

export default function UniversityDataImport({
  activeSubjectId,
  onUseSubject,
}: UniversityDataImportProps) {
  const [jsonText, setJsonText] = useState(sampleJson);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importedSubjects, setImportedSubjects] = useState<ImportedSubject[]>([]);

  const handleValidate = () => {
    try {
      const data = parseAcademicJson(jsonText);
      validateAcademicData(data);

      setMessage(
        `Valid JSON: ${data.length} universit${data.length === 1 ? "y" : "ies"} found.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON validation failed.");
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setMessage("Importing academic data...");
    setSummary(null);
    setImportedSubjects([]);

    try {
      const data = parseAcademicJson(jsonText);
      validateAcademicData(data);

      const response = await fetch(`${ADMIN_API_BASE_URL}/academic-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ universities: data }),
      });

      if (!response.ok) {
        throw new Error(await readImportError(response));
      }

      const result = (await response.json()) as AcademicImportResponse;

      if (!result.success || !result.summary) {
        throw new Error(result.error || result.detail || "Import failed.");
      }

      setSummary(result.summary);
      setImportedSubjects(result.subjects || []);

      setMessage(
        `Import complete: ${result.summary.universities} universities, ${result.summary.branches} branches, ${result.summary.subjects} subjects.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-import">
      <div className="ai-import-grid">
        <div className="ai-panel ai-import-editor">
          <div className="ai-panel-head">
            <div>
              <h2>Climbup Academic Import</h2>
              <p>{message}</p>
            </div>

            <div className="ai-actions">
              <button
                className="ai-button"
                disabled={loading}
                type="button"
                onClick={handleValidate}
              >
                Validate
              </button>

              <button
                className="ai-button ai-button-primary"
                disabled={loading}
                type="button"
                onClick={handleImport}
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </div>
          </div>

          <div className="ai-connection">
            <span>API</span>
            <strong>{ADMIN_API_BASE_URL}</strong>
          </div>

          <textarea
            className="ai-json"
            spellCheck={false}
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
          />

          <div className="ai-footnote">
            <span>IDs are generated by Supabase/backend, not entered by admin.</span>

            <button
              className="ai-link-button"
              type="button"
              onClick={() => setJsonText(sampleJson)}
            >
              Load sample
            </button>
          </div>
        </div>

        <aside className="ai-panel ai-results">
          <div className="ai-panel-head">
            <div>
              <h2>Imported Subjects</h2>
              <p>
                {summary
                  ? `${summary.subjects} subject${summary.subjects === 1 ? "" : "s"} ready`
                  : "No import yet"}
              </p>
            </div>
          </div>

          <div className="ai-summary-grid">
            <div>
              <span>Universities</span>
              <strong>{summary?.universities ?? "-"}</strong>
            </div>
            <div>
              <span>Branches</span>
              <strong>{summary?.branches ?? "-"}</strong>
            </div>
            <div>
              <span>Subjects</span>
              <strong>{summary?.subjects ?? "-"}</strong>
            </div>
          </div>

          <div className="ai-subject-list">
            {!importedSubjects.length && (
              <div className="ai-empty">Imported subject rows will appear here.</div>
            )}

            {importedSubjects.map((subject) => (
              <article
                className="ai-subject-card"
                key={`${subject.subject_id}-${subject.semester}`}
              >
                <div>
                  <strong>{subject.subject_name}</strong>
                  <span>{buildSubjectLabel(subject)}</span>
                  <code>{subject.subject_id}</code>
                </div>

                <button
                  className="ai-button"
                  disabled={!onUseSubject || activeSubjectId === subject.subject_id}
                  type="button"
                  onClick={() => onUseSubject?.(subject)}
                >
                  {activeSubjectId === subject.subject_id ? "Selected" : "Use"}
                </button>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
