/* Verifies the configured provider end to end: real call, real schema check.
   Run with `npm run ai:smoke`. */
import { aiConfig } from '../config/ai.js';
import { isAiEnabled } from './index.js';
import { suggestMeta } from './tasks/seo.js';

const BODY = `650 units of 16-storey serviced apartments across three blocks — Block A
201 units, Block B 209 units, Block C 240 units — over one retail level of 9 units.
Phase 1 2023-2026, Phase 2 2024-2027. GDV RM 300 million.`;

async function main() {
  console.log(`provider = ${aiConfig.provider}`);
  console.log(`model    = ${aiConfig.model}`);

  if (!isAiEnabled()) {
    console.log('\nAI is not configured. Set AI_PROVIDER and the matching key in .env.');
    process.exit(0);
  }

  const result = await suggestMeta({
    kind: 'project',
    name: 'Residensi Mutiara Austin',
    location: 'Mount Austin, Johor Bahru',
    body: BODY,
    focusKeyword: 'serviced apartment Johor Bahru',
    locale: 'EN',
  });

  console.log(`\n${result.provider}/${result.model} · ${result.latencyMs}ms · ` +
    `${result.inputTokens} in / ${result.outputTokens} out\n`);

  result.data.variants.forEach((v, i) => {
    console.log(`${i + 1}. ${v.title}  [${v.title.length} chars]`);
    console.log(`   ${v.description}  [${v.description.length} chars]`);
    console.log(`   ${v.rationale}\n`);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
