import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mehak-techno.prathambatra68.chatgpt.site"),
  title: "Mehak's Private Frequency",
  description:
    "Mac's private, immersive techno listening room made for Mehak.",
  openGraph: {
    title: "Mehak's Private Frequency",
    description: "Mac's private techno listening room, tuned only for Mehak.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Mehak's Private Frequency",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mehak's Private Frequency",
    description: "Mac's private techno listening room, tuned only for Mehak.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
