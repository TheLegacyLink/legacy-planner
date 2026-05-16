/**
 * Legacy Link Store — Product Catalog Seed
 * Admin panel at /store/admin can override prices, images, tags, and variant IDs.
 * printfulVariantIds must be filled in once products are created in Printful dashboard.
 */
export const STORE_SEED = {
  _version: '1',
  hero: {
    headline: 'Build something the world\ncan\'t take back.',
    tagline: 'Representing the standard you live by — not just what you wear.',
    cta: 'Shop the Collection',
  },
  compliance: 'Apparel and merchandise are not affiliated with any insurance carrier.',
  products: [
    {
      sku: 'LL-TEE-BLK-001',
      name: 'Legacy Crew Tee',
      subtitle: 'Black / White',
      category: 'tees',
      tag: 'FEATURED',
      price: 35,
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
      price: 35,
      description: "Same tee. Different statement. Royal blue with white seal — for when black isn't the move.",
      garment: 'Bella+Canvas 3001 — 100% combed ringspun cotton, 5.3 oz, fitted crew neck.',
      image: '/store/store-tee-blue-placeholder.png',
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
      price: 35,
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
      price: 85,
      description: 'Heavyweight black fleece with the full lockup in gold across the chest. Made for the people building something nobody handed them.',
      garment: 'Heavyweight 9–10 oz pullover hoodie — ringspun cotton/poly fleece, kangaroo pocket. Clean hood, no drawstrings.',
      image: '/store/store-hoodie-placeholder.png',
      colors: [{ label: 'Black', hex: '#0B0B0B' }],
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      printfulVariantIds: { S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '' },
      active: true
    }
  ]
};
