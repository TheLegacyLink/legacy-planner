import './globals.css';

export const metadata = {
  title: 'Legacy Planner',
  description: 'Mission Control + Planner OS'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
