import "./globals.css";

export const metadata = {
  title: "TeamUP",
  description: "TeamUP App",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}