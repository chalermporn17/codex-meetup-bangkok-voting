import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'One-Shot Build Challenge · Bangkok',
  description:
    'Submit, explore, and vote in the Codex Community Meetup Bangkok #3 One-Shot Build Challenge.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
