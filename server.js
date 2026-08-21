require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const NAMESILO_API_KEY = process.env.NAMESILO_API_KEY;

if (!NAMESILO_API_KEY) {
  console.error('ERROR: NAMESILO_API_KEY environment variable is not set.');
  process.exit(1);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

app.use(helmet());
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isValidDomain(domain) {
  const pattern = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/search', async (req, res) => {
  try {
    const domainsParam = req.query.domains || req.query.domain;
    if (!domainsParam) {
      return res.status(400).json({ error: 'Please provide domains as a comma-separated list.' });
    }
    const domains = domainsParam.split(',').map(d => d.trim()).filter(Boolean);
    if (domains.length === 0 || domains.length > 20) {
      return res.status(400).json({ error: 'Provide between 1 and 20 domains.' });
    }
    for (const domain of domains) {
      if (!isValidDomain(domain)) {
        return res.status(400).json({ error: `Invalid domain format: ${domain}` });
      }
    }
    const result = await checkDomains(domains);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/search:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { domains } = req.body;
    if (!domains || (Array.isArray(domains) && domains.length === 0) || (typeof domains !== 'string' && !Array.isArray(domains))) {
      return res.status(400).json({ error: 'Please provide domains as a string or array of strings.' });
    }
    const domainList = Array.isArray(domains) ? domains : domains.split(',').map(d => d.trim()).filter(Boolean);
    if (domainList.length === 0 || domainList.length > 20) {
      return res.status(400).json({ error: 'Provide between 1 and 20 domains.' });
    }
    for (const domain of domainList) {
      if (!isValidDomain(domain)) {
        return res.status(400).json({ error: `Invalid domain format: ${domain}` });
      }
    }
    const result = await checkDomains(domainList);
    res.json(result);
  } catch (error) {
    console.error('Error in POST /api/search:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function checkDomains(domains) {
  const params = {
    version: 1,
    type: 'xml',
    key: NAMESILO_API_KEY,
    domains: domains.join(',')
  };
  const response = await axios.get('https://www.namesilo.com/api/checkRegisterAvailability', {
    params,
    timeout: 10000
  });
  const xmlData = response.data;
  const parsed = parser.parse(xmlData);
  const reply = parsed.namesilo?.reply;
  if (!reply) {
    throw new Error('Unexpected response structure from NameSilo');
  }
  const code = parseInt(reply.code, 10);
  const detail = reply.detail;
  if (code !== 300) {
    return { success: false, code, detail, results: [] };
  }
  const availableDomains = toArray(reply.available?.domain);
  const unavailableDomains = toArray(reply.unavailable?.domain);
  const invalidDomains = toArray(reply.invalid?.domain);
  const results = domains.map(domain => {
    if (availableDomains.includes(domain)) return { domain, available: true, status: 'available' };
    if (unavailableDomains.includes(domain)) return { domain, available: false, status: 'unavailable' };
    if (invalidDomains.includes(domain)) return { domain, available: false, status: 'invalid' };
    return { domain, available: null, status: 'unknown' };
  });
  return { success: true, code, detail, results };
}

app.listen(PORT, () => {
  console.log(`NameSilo Domain Search API running on port ${PORT}`);
});
