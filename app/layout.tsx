import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Ruta Carga 3D | Navegación para transporte pesado",
  description:
    "Prototipo académico de rutas seguras para camiones con restricciones físicas, algoritmo A* y simulación 3D.",
  openGraph: {
    title: "Ruta Carga 3D",
    description: "Navegación segura para transporte pesado",
    images: [{ url: "/og.png", width: 1774, height: 887, alt: "Ruta Carga 3D" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ruta Carga 3D",
    description: "Navegación segura para transporte pesado",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
