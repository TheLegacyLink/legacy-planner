const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com';

export const metadata = {
  title: 'Legacy Link Store',
  description: 'Wear the standard. Build the legacy. Become the link.',
  openGraph: {
    title: 'Legacy Link Store',
    description: 'Wear the standard. Build the legacy. Become the link.',
    url: `${APP_URL}/store`,
    siteName: 'The Legacy Link',
    images: [
      {
        url: `${APP_URL}/store/store-hoodie-black-v2.png`,
        width: 1200,
        height: 1600,
        alt: 'Independence Hoodie — Black / Gold | The Legacy Link Store'
      }
    ],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legacy Link Store',
    description: 'Wear the standard. Build the legacy. Become the link.',
    images: [`${APP_URL}/store/store-hoodie-black-v2.png`]
  }
};

export default function StoreLayout({ children }) {
  return children;
}
