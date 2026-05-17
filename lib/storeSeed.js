/**
 * Legacy Link Store — Product Catalog Seed
 * Admin panel at /store/admin can override prices, images, tags, and variant IDs.
 * printfulVariantIds must be filled in once products are created in Printful dashboard.
 */
export const STORE_SEED = {
  _version: '10',
  hero: {
    headline: 'Every Legacy\nNeeds A Link.',
    tagline: 'Wear the standard. Build the legacy. Become the link.',
    cta: 'SHOP THE COLLECTION',
  },
  compliance: 'Apparel and merchandise are not affiliated with any insurance carrier.',
  products: [
    {
      sku: 'LL-TEE-BLK-001',
      name: 'Legacy Crew Tee',
      subtitle: 'Black / White',
      category: 'tees',
      tag: 'FEATURED',
      price: 40,
      description: 'Heavyweight cotton. Clean lines. Built to be worn. The Legacy Link signature seal, white on black.',
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-black-v2.png',
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },
    {
      sku: 'LL-TEE-RYL-001',
      name: 'Legacy Crew Tee',
      subtitle: 'Royal Blue / White',
      category: 'tees',
      tag: 'NEW',
      price: 40,
      description: "Same tee. Different statement. Royal blue with white seal — for when black isn't the move.",
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-royal-blue-v2.png',
      colors: [{ label: 'Royal Blue', hex: '#1740C4' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },
    {
      sku: 'LL-TEE-WHT-001',
      name: 'Legacy Crew Tee',
      subtitle: 'White / Black',
      category: 'tees',
      tag: null,
      price: 40,
      description: 'The clean version. White cotton, black seal, no noise.',
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-white-v2.png',
      colors: [{ label: 'White', hex: '#F2F0EA' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    },
    {
      sku: 'LL-POL-BLK-001',
      name: 'LL Signature Polo',
      subtitle: 'Black / Gold',
      category: 'polos',
      tag: 'FEATURED',
      price: 65,
      description: 'Pique cotton polo with the Legacy Link seal embroidered in gold on the left chest. Country club energy, builder mentality.',
      garment: 'Heavyweight pique cotton polo — 3-button placket, slim modern fit. Gold metallic embroidery, left chest.',
      image: '/store/store-polo-black-v2.png',
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '' },
      active: true
    },
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
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    }
  ,
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
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    }
  ,
    {
      sku: 'LL-POL-WHT-001',
      name: 'LL Signature Polo',
      subtitle: 'White / Black',
      category: 'polos',
      tag: 'NEW',
      price: 65,
      description: 'The clean version of the Signature Polo. White pique cotton with the Legacy Link seal in black on the left chest. Sharp, versatile, built to represent.',
      garment: 'Heavyweight pique cotton polo — 3-button placket, slim modern fit. Black embroidery, left chest.',
      image: '/store/store-polo-white-v2.png',
      colors: [{ label: 'White', hex: '#F2F0EA' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '' },
      active: true
    }
  ,
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
      colors: [{ label: 'Navy / Gold', hex: '#0A1628' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: {},
      earnOnly: true,
      active: true
    }
  ,
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
      colors: [{ label: 'Black / Multi', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      printfulVariantIds: {},
      earnOnly: true,
      active: true
    }
  ,
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
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    }
  ]
};
