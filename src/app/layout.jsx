import "./globals.css";
export const metadata = {
  title: "PredictorUG - Daily Safe Tickets & AI Analysis",
  description: "Get researched football accumulators with live data and Claude AI analysis. The most reliable betting predictions in Uganda.",
  manifest: "/manifest.json",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#00D45E",
  openGraph: {
    title: "PredictorUG - AI-Powered Winning Tickets",
    description: " researched football accumulators with live data.",
    url: "https://predictor-ug.vercel.app",
    siteName: "PredictorUG",
    locale: "en_UG",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
