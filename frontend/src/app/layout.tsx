import "./globals.css";
import "../styles/select.css";

export const metadata = {
  title: "VGC Shelf",
  description: "Video game collection tracking",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
