import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.FIRECRAWL_API_KEY;

if (!apiKey) {
  console.log('Firecrawl API key not configured — using manual data');
  process.exit(0);
}

// Optional command line argument for a specific product slug
const targetSlug = process.argv[2];

const saasDir = path.join(__dirname, '../src/content/saas');

async function scrapeProduct(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const product = JSON.parse(fileContent);

  console.log(`\n--- Scraping ${product.name} (${product.slug}) ---`);

  let targetUrl = product.websiteUrl;
  if (!targetUrl.includes('/pricing') && !targetUrl.includes('pricing.')) {
    targetUrl = targetUrl.replace(/\/$/, '') + '/pricing';
  }

  console.log(`Target URL: ${targetUrl}`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['json'],
        jsonOptions: {
          schema: {
            type: 'object',
            properties: {
              plans: {
                type: 'array',
                description: 'List of pricing plans found on the page',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Normalized plan ID, e.g. free, starter, pro, business, enterprise' },
                    name: { type: 'string', description: 'Display name of the plan' },
                    priceMonthly: { type: 'number', description: 'Monthly price when billed month-to-month. Leave null if not available' },
                    priceAnnually: { type: 'number', description: 'Total annual cost when billed annually. E.g. if $10/mo billed annually, this is 120.' }
                  },
                  required: ['id', 'name']
                }
              }
            },
            required: ['plans']
          }
        }
      })
    });

    if (!response.ok) {
      console.error(`Firecrawl API error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();
    if (!data.success || !data.data || !data.data.json || !data.data.json.plans) {
      console.warn(`No plan data returned or scrape failed for ${product.name}. Full response:`, JSON.stringify(data));
      return;
    }

    const scrapedPlans = data.data.json.plans;
    console.log(`Scraped plans found:`, JSON.stringify(scrapedPlans));

    let updated = false;
    for (const originalPlan of product.plans) {
      // Find a matching scraped plan by ID or Name case-insensitively
      const match = scrapedPlans.find(sp => 
        sp.id?.toLowerCase() === originalPlan.id?.toLowerCase() ||
        sp.name?.toLowerCase() === originalPlan.name?.toLowerCase()
      );

      if (match) {
        if (match.priceMonthly !== undefined && match.priceMonthly !== originalPlan.priceMonthly) {
          console.log(`  Updating plan "${originalPlan.name}" monthly price: $${originalPlan.priceMonthly} -> $${match.priceMonthly}`);
          originalPlan.priceMonthly = match.priceMonthly;
          updated = true;
        }
        if (match.priceAnnually !== undefined && match.priceAnnually !== originalPlan.priceAnnually) {
          console.log(`  Updating plan "${originalPlan.name}" annual price: $${originalPlan.priceAnnually} -> $${match.priceAnnually}`);
          originalPlan.priceAnnually = match.priceAnnually;
          updated = true;
        }
      }
    }

    if (updated) {
      product.lastVerified = new Date().toISOString().split('T')[0];
      fs.writeFileSync(filePath, JSON.stringify(product, null, 2) + '\n', 'utf8');
      console.log(`Saved updates to ${filePath}`);
    } else {
      console.log(`No matching price changes detected.`);
    }

  } catch (err) {
    console.error(`Error scraping ${product.name}:`, err);
  }
}

async function main() {
  if (targetSlug) {
    const filePath = path.join(saasDir, `${targetSlug}.json`);
    if (fs.existsSync(filePath)) {
      await scrapeProduct(filePath);
    } else {
      console.error(`Product file not found: ${filePath}`);
    }
  } else {
    const files = fs.readdirSync(saasDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(saasDir, file);
      await scrapeProduct(filePath);
      // Wait a short delay to avoid overwhelming rates or limits
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
