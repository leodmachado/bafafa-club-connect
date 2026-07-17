const input = process.argv[2];
if (!input) {
  console.error("Uso: npm run security:headers -- https://seu-app.vercel.app");
  process.exit(1);
}

const base = new URL(input);
const target = new URL("/auth", base);
const response = await fetch(target, { redirect: "manual" });

const required = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "x-robots-tag",
  "cache-control",
];

let failed = false;
console.log(`\nVerificando ${target} — HTTP ${response.status}\n`);
for (const name of required) {
  const value = response.headers.get(name);
  const ok = Boolean(value);
  if (!ok) failed = true;
  console.log(`${ok ? "OK " : "FALTA"} ${name}: ${value ?? "—"}`);
}

const csp = response.headers.get("content-security-policy") ?? "";
for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
  const ok = csp.includes(directive);
  if (!ok) failed = true;
  console.log(`${ok ? "OK " : "FALTA"} CSP ${directive}`);
}

if (failed) {
  console.error("\nA verificação encontrou cabeçalhos ausentes.");
  process.exit(2);
}

console.log("\nCabeçalhos mínimos encontrados.");
