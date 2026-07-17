import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  "node_modules",
  ".vercel",
  ".output",
  "dist",
  "backups",
  "docs",
]);
const allowedEnvFiles = new Set([".env.example"]);
const textExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".md",
]);

const patterns = [
  { name: "chave secreta Supabase", regex: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  { name: "token pessoal GitHub", regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g },
  { name: "token fino GitHub", regex: /github_pat_[A-Za-z0-9_]{40,}/g },
  { name: "access key AWS", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "chave privada", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "service role atribuída em variável",
    regex:
      /SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*=\s*["'](?!SEU_|YOUR_|\$\{)[A-Za-z0-9._-]{20,}["']/gi,
  },
  {
    name: "URL Postgres com senha embutida",
    regex: /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@[^\s"']+/gi,
  },
];

const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (entry.name.startsWith(".env") && !allowedEnvFiles.has(entry.name)) {
      findings.push(`${relative}: arquivo de ambiente não deve ser versionado`);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name)) && !entry.name.startsWith(".env")) continue;
    const fileStat = await stat(absolute);
    if (fileStat.size > 2_000_000) continue;
    const content = await readFile(absolute, "utf8");
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(content)) findings.push(`${relative}: possível ${pattern.name}`);
    }
  }
}

await walk(root);

if (findings.length) {
  console.error("\nPossíveis segredos encontrados:\n");
  findings.forEach((finding) => console.error(`- ${finding}`));
  console.error("\nRevise antes de fazer push. O script não imprime os valores encontrados.\n");
  process.exit(1);
}

console.log("Nenhum segredo de alta confiança foi encontrado nos arquivos do projeto.");
