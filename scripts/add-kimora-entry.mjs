import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '../data/licensedAgents.json');

const data = JSON.parse(readFileSync(filePath, 'utf8'));

// Remove any existing kimora@thelegacylink.com entries to avoid duplicates
const filtered = data.filter(r => String(r.email || '').toLowerCase() !== 'kimora@thelegacylink.com');

const kimoraEntry = {
  agent_id: "000631664",
  full_name: "LINK, KIMORA",
  email: "kimora@thelegacylink.com",
  email_alt: "investalinkinsurance@gmail.com",
  phone: "646-945-9530",
  city: "NEW YORK",
  home_state: "NY",
  state_code: "NY",
  license_status: "Active",
  licensed_states: ["AZ","CO","CT","DE","DC","FL","GA","IN","KY","LA","MD","MO","NJ","NY","NC","OH","PA","SC","TN","TX","VA"],
  carriers_active: ["F&G","Mutual of Omaha","National Life Group"],
  carriers_all: ["F&G","Mutual of Omaha","National Life Group"],
  carrier_details: [
    { carrier: "F&G", contract_status: "Active", carrier_agent_id: "000631664" },
    { carrier: "Mutual of Omaha", contract_status: "Active", carrier_agent_id: "2058112" },
    { carrier: "National Life Group", contract_status: "Active", carrier_agent_id: "7685T" }
  ],
  effective_date: "06-14-2024"
};

// Insert after the first entry (legend row)
const legendRow = filtered.slice(0, 1);
const rest = filtered.slice(1);
const result = [...legendRow, kimoraEntry, ...rest];

writeFileSync(filePath, JSON.stringify(result, null, 2));
console.log(`Done. Total entries: ${result.length}. Kimora added at index 1.`);
