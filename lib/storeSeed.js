/**
 * Legacy Link Store — Product Catalog Seed v11
 * Admin panel at /store/admin can override prices, images, tags, and variant IDs.
 * printfulVariantIds must be filled in once products are created in Printful dashboard.
 *
 * Color variants: each color entry can have { label, hex, image } — product detail
 * page will show a color picker and swap the image. First color is always shown by default.
 */
export const STORE_SEED = {
  _version: '11',
  hero: {
    headline: 'Every Legacy\nNeeds A Link.',
    tagline: 'Wear the standard. Build the legacy. Become the link.',
    cta: 'SHOP THE COLLECTION',
  },
  compliance: 'Apparel and merchandise are not affiliated with any insurance carrier.',
  products: [
    // ─── TEES ──────────────────────────────────────────────────────────────────
    {
      sku: 'LL-TEE-CREW-001',
      name: 'Legacy Crew Tee',
      subtitle: 'Black · Royal Blue · White',
      category: 'tees',
      tag: 'FEATURED',
      price: 40,
      description: 'Heavyweight cotton. Clean lines. Built to be worn. The Legacy Link signature seal — available in black, royal blue, and white.',
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-black-v2.png',
      colors: [
        { label: 'Black',      hex: '#0B0B0B', image: '/store/store-tee-black-v2.png' },
        { label: 'Royal Blue', hex: '#1740C4', image: '/store/store-tee-royal-blue-v2.png' },
        { label: 'White',      hex: '#F2F0EA', image: '/store/store-tee-white-v2.png' }
      ],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },
    {
      sku: 'LL-TEE-WIT-BLK-001',
      name: 'Whatever It Takes Tee',
      subtitle: 'Black / Gold',
      category: 'tees',
      tag: 'NEW',
      price: 40,
      description: 'Black tee with the Whatever It Takes chain-link figure in gold across the chest. Same energy as the hoodie — built for the ones who keep moving.',
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-wit-black-v2.png',
      colors: [{ label: 'Black', hex: '#0B0B0B', image: '/store/store-tee-wit-black-v2.png' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },

    // ─── HOODIES ───────────────────────────────────────────────────────────────
    {
      sku: 'LL-HOD-BLK-001',
      name: 'Independence Hoodie',
      subtitle: 'Black / Gold',
      category: 'hoodies',
      tag: 'FEATURED',
      price: 95,
      description: 'Heavyweight black fleece with the full lockup in gold across the chest. Made for the people building something nobody handed them.',
      garment: 'Heavyweight 9–10 oz pullover hoodie — ringspun cotton/poly fleece, kangaroo pocket. Clean hood, no drawstrings.',
      image: '/store/store-hoodie-black-v2.png',
      colors: [{ label: 'Black', hex: '#0B0B0B', image: '/store/store-hoodie-black-v2.png' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },
    {
      sku: 'LL-HOD-WIT-001',
      name: 'Whatever It Takes Hoodie',
      subtitle: 'Black / White & Gold',
      category: 'hoodies',
      tag: 'NEW',
      price: 95,
      description: 'Black pullover hoodie with the Whatever It Takes graphic across the chest — chain-link figure, gold accents, Legacy Link at the base. Built for the ones who show up.',
      garment: 'Heavyweight pullover hoodie — kangaroo pocket, drawstring hood, cotton/poly fleece blend.',
      image: '/store/store-hoodie-wit-v2.png',
      colors: [{ label: 'Black', hex: '#0B0B0B', image: '/store/store-hoodie-wit-v2.png' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },

    // ─── SWEATSUIT ─────────────────────────────────────────────────────────────
    {
      sku: 'LL-SET-BLK-001',
      name: 'Legacy Sweatsuit',
      subtitle: 'Black / Gold — Matching Set',
      category: 'sweatsuits',
      tag: 'NEW',
      price: 145,
      description: 'The full set. Heavyweight fleece jogger and crew — Legacy Link seal in gold, clean silhouette, built to move in. Sold as a matching set.',
      garment: 'Heavyweight cotton/poly fleece — matching crew and jogger, ribbed cuffs and hem, Legacy Link gold seal embroidered on chest and left leg.',
      image: '',
      colors: [{ label: 'Black', hex: '#0B0B0B', image: '' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },

    // ─── POLOS ─────────────────────────────────────────────────────────────────
    {
      sku: 'LL-POL-001',
      name: 'LL Signature Polo',
      subtitle: 'Black · White',
      category: 'polos',
      tag: 'FEATURED',
      price: 65,
      description: 'Pique cotton polo with the Legacy Link seal embroidered on the left chest. Available in black/gold and white/black. Country club energy, builder mentality.',
      garment: 'Heavyweight pique cotton polo — 3-button placket, slim modern fit. Metallic embroidery, left chest.',
      image: '/store/store-polo-black-v2.png',
      colors: [
        { label: 'Black', hex: '#0B0B0B', image: '/store/store-polo-black-v2.png' },
        { label: 'White', hex: '#F2F0EA', image: '/store/store-polo-white-v2.png' }
      ],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '' },
      active: true
    },

    // ─── HATS ──────────────────────────────────────────────────────────────────
    {
      sku: 'LL-HAT-BLK-001',
      name: 'Legacy Link Cap',
      subtitle: 'Black / Gold',
      category: 'hats',
      tag: 'NEW',
      price: 38,
      description: 'Structured black snapback with the Legacy Link crest embroidered in gold on the front panel. Flat brim, clean finish.',
      garment: 'Structured 6-panel snapback — 100% cotton, flat brim, adjustable snap closure. Gold embroidery on front panel.',
      image: '',
      colors: [{ label: 'Black', hex: '#0B0B0B', image: '' }],
      sizes: ['One Size'],
      printfulVariantIds: { 'One Size': '' },
      active: true
    },

    // ─── OUTERWEAR / EARN ONLY ─────────────────────────────────────────────────
    {
      sku: 'LL-JKT-ELITE-001',
      name: 'Inner Circle Elite Jacket',
      subtitle: 'Navy / Gold — Exclusive',
      category: 'outerwear',
      tag: 'EARN ONLY',
      price: 0,
      description: 'Navy bomber jacket with gold baroque chain-link pattern, gold zipper, and embroidered crest on the chest. This piece is not sold. It is earned.',
      garment: 'Premium bomber jacket — deep navy with gold baroque damask print, ribbed gold-stripe collar and cuffs, full gold zipper. Inner Circle Elite exclusive.',
      image: '/store/store-jacket-elite-v2.png',
      colors: [{ label: 'Navy / Gold', hex: '#0A1628', image: '/store/store-jacket-elite-v2.png' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: {},
      earnOnly: true,
      active: true
    },
    {
      sku: 'LL-JKT-IC-001',
      name: 'Inner Circle Jacket',
      subtitle: 'Black / All-Over Print',
      category: 'outerwear',
      tag: 'EARN ONLY',
      price: 0,
      description: 'Black bomber with an all-over Legacy Link typographic print in royal blue, orange, and white. Inner Circle badge on the left chest. This piece is not sold. It is earned.',
      garment: 'Bomber jacket — black base with all-over Legacy Link word print, ribbed collar, cuffs and hem, full front zipper, side pockets. Inner Circle exclusive.',
      image: '/store/store-jacket-ic-v2.png',
      colors: [{ label: 'Black / Multi', hex: '#0B0B0B', image: '/store/store-jacket-ic-v2.png' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: {},
      earnOnly: true,
      active: true
    }
  ]
};
