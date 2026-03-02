import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

// Only protect dashboard; /audit/* is public so shared links can be viewed without sign-in
export const config = {
  matcher: ["/dashboard/:path*"],
};
