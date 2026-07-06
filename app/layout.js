export const metadata = {
  title: "급식 식단표 도우미",
  description: "나이스(NEIS) 급식 데이터로 월간 식단표를 만드는 앱",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
