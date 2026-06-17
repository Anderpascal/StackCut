import fs from 'fs';
import path from 'path';

const saasDir = 'c:\\Users\\ander.pascal\\Desktop\\Cosas\\web cossa\\Asesinos saas\\src\\content\\saas';
const files = fs.readdirSync(saasDir);

let output = [];

files.forEach(file => {
  if (!file.endsWith('.json')) return;
  const filePath = path.join(saasDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const planInfo = data.plans.map(p => `${p.name}: $${p.priceMonthly}/mo ($${p.priceAnnually}/yr)`).join(' | ');
  output.push(`${data.name} (${file}): ${planInfo}`);
});

fs.writeFileSync('c:\\Users\\ander.pascal\\Desktop\\Cosas\\web cossa\\Asesinos saas\\scratch_all_prices.txt', output.join('\n'));
console.log('Done writing all prices!');
