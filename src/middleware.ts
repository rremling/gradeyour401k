import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Redirect /grade/result -> /grade/results (preserve querystring)
  if (req.nextUrl.pathname === "/grade/result") {
    const url = req.nextUrl.clone();
    url.pathname = "/grade/results"; // keep search params
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/grade/result"],
};
