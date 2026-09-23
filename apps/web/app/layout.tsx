import type { Metadata } from 'next';
import './style.css';

export const metadata: Metadata = {
  title: 'Wallet Loyalty Card',
  description: 'Tarjetas de lealtad digitales para negocios.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
