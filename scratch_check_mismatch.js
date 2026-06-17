import fs from 'fs';
import path from 'path';

const saasDir = 'c:\\Users\\ander.pascal\\Desktop\\Cosas\\web cossa\\Asesinos saas\\src\\content\\saas';
const files = fs.readdirSync(saasDir);

let mismatches = [];

files.forEach(file => {
  if (!file.endsWith('.json')) return;
  const filePath = path.join(saasDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  data.plans.forEach(p => {
    if (p.priceMonthly !== null && p.priceAnnually !== null && p.priceMonthly > 0) {
      const calculatedAnnual = p.priceMonthly * 12;
      if (calculatedAnnual !== p.priceAnnually) {
        mismatches.push(`${data.name} (${file}) - Plan "${p.name}": monthly is $${p.priceMonthly}, annual is $${p.priceAnnually} (calculated annual: $${calculatedAnnual})`);
      }
    }
  });
});

console.log(`Found ${mismatches.length} plan mismatches:`);
mismatches.forEach(m => console.log(' - ' + m));
