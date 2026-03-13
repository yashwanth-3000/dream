const STUDY_FILE_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".yaml",
  ".yml",
  ".log",
];

const STUDY_FILE_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/yaml",
  "text/yaml",
  "text/x-log",
]);

export const STUDY_FILE_ACCEPT =
  ".pdf,.txt,.md,.markdown,.csv,.json,.xml,.html,.htm,.yaml,.yml,.log,application/pdf,text/plain,text/markdown,text/csv,application/json,application/xml,text/xml,text/html,application/yaml,text/yaml";

export const STUDY_FILE_HELPER_TEXT =
  "Supported study files: PDF, TXT, MD, CSV, JSON, XML, HTML, YAML, LOG.";

export function isSupportedStudyFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const type = (file.type || "").trim().toLowerCase();
  const name = (file.name || "").trim().toLowerCase();
  return STUDY_FILE_CONTENT_TYPES.has(type) || STUDY_FILE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function isStudyPdfFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const type = (file.type || "").trim().toLowerCase();
  const name = (file.name || "").trim().toLowerCase();
  return type === "application/pdf" || type === "application/x-pdf" || name.endsWith(".pdf");
}
