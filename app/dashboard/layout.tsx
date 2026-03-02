// Force dynamic rendering so the session is read on every request.
// Without this, Next.js can cache the dashboard and show the previous user's data after logout/login.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
