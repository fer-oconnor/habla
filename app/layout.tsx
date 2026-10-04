import type { Metadata } from "next";
/* eslint-disable @next/next/no-css-tags -- The DOM app intentionally uses its existing versioned public stylesheet. */

export const metadata: Metadata = {
  title: "Habla · Aprende Python y SQL",
  description: "Escribe código, supera retos y retoma tu progreso desde cualquier dispositivo.",
  icons: {
    icon: "/assets/favicon.svg?v=logo20261003",
    shortcut: "/assets/favicon.svg?v=logo20261003",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head><link rel="stylesheet" href="/css/styles.css?v=studio20261003" /></head>
      <body>{children}</body>
    </html>
  );
}
