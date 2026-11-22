// ─── Gift Quest configuration ────────────────────────────────────────────────
// Fill these in with your own values. Everything works locally with demo data
// until you connect Airtable / n8n.

window.GIFTQUEST_CONFIG = {

  // n8n webhook base URL (create a webhook node in n8n, e.g. /giftquest).
  // All API calls go through n8n, which then writes/reads your Airtable base.
  N8N_BASE: 'https://limegreen-bison-101856.hostingersite.com/webhook/giftquest',

  // Your Airtable base — CREATED ✅ as its own standalone base.
  // Base URL: https://airtable.com/appBcuXing8ySWfAi
  AIRTABLE: {
    baseId: 'appBcuXing8ySWfAi',
    giftsTable: 'Gifts',                  // tbl1dZBjb71w0IXuy
    contributionsTable: 'Contributions',  // tbl4viwF8YjEccN5O
    peopleTable: 'People',                // tblrW3sL1ju3tQzLI
  },

  // Banking details shown so people know where to pay (populated from People table).
  BANKING: {
    accountName: 'Gift Quest Group Fund',
    bank: 'FNB',
    accountNumber: '• •• 1234',
    branchCode: '250655',
    reference: 'GIFTQUEST',
    paymentNote: 'Use your name as the payment reference so we can match it!',
  },

  // The fixed group of people in your circle (synced with the People table in Airtable).
  PEOPLE: [
    { id: 'p1', name: 'Brad', emoji: '🧑‍💻' },
    { id: 'p2', name: 'Thandi', emoji: '👩‍🎨' },
    { id: 'p3', name: 'Sipho', emoji: '🧑‍🏫' },
    { id: 'p4', name: 'Aisha', emoji: '👩‍🍳' },
    { id: 'p5', name: 'Johan', emoji: '🧑‍🔧' },
    { id: 'p6', name: 'Lerato', emoji: '👩‍⚕️' },
    { id: 'p7', name: 'Kagiso', emoji: '🧑‍🌾' },
    { id: 'p8', name: 'Nadia', emoji: '👩‍💻' },
    { id: 'p9', name: 'Pieter', emoji: '🧑‍🚀' },
    { id: 'p10', name: 'Zanele', emoji: '👩‍🎓' },
  ],

  // Demo wishes — replaced by Airtable data once N8N_BASE is set.
  DEMO_GIFTS: [
    { id: 'g1', person: 'p1', event: 'birthday', title: 'PlayStation 5 DualSense Edge Controller',
      price: 2499, description: 'My old one has drift — this would change my whole gaming setup 🎮',
      link: 'https://www.takealot.com/ps5-dualsense-edge/PLID92345678', source: 'Takealot' },
    { id: 'g2', person: 'p2', event: 'christmas', title: 'Kindle Paperwhite Signature Edition',
      price: 3299, description: 'Reading more novels is my 2027 resolution 📚',
      link: 'https://www.amazon.co.za/dp/B08KTZ8249', source: 'Amazon.co.za' },
    { id: 'g3', person: 'p3', event: 'birthday', title: 'DeWalt 18V Cordless Drill Combo Kit',
      price: 1850, description: 'Finally fixing up the house project ⚒️',
      link: 'https://www.takealot.com/dewalt-drill-kit/PLID87654321', source: 'Takealot' },
    { id: 'g4', person: 'p4', event: 'christmas', title: 'Nespresso Vertuo Next Coffee Machine',
      price: 2999, description: 'My mornings deserve better than instant ☕',
      link: 'https://www.takealot.com/nespresso-vertuo/PLID76543210', source: 'Takealot' },
  ],

  // Demo contributions (Airtable replaces these once connected).
  DEMO_CONTRIBUTIONS: [
    { id: 'c1', giftId: 'g1', person: 'Thandi', amount: 500, done: true },
    { id: 'c2', giftId: 'g1', person: 'Sipho', amount: 250, done: false },
    { id: 'c3', giftId: 'g2', person: 'Brad', amount: 1000, done: true },
  ],
};
