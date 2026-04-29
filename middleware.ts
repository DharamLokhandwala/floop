import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

// Protect dashboard and onboarding. /audit/* is public so shared links work without sign-in.
export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
