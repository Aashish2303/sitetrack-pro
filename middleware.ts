import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, isAppPath, safeReturnTo } from "./lib/routing.mjs";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  function redirect(pathname: string, params?: Record<string,string>) {
    const url = new URL(pathname, request.url);
    Object.entries(params || {}).forEach(([key,value]) => url.searchParams.set(key,value));
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    redirected.headers.set('Cache-Control', 'private, no-store');
    return redirected;
  }

  if (!user && (path === '/' || isAppPath(path) || path === '/access-denied')) {
    return redirect('/login', {next: safeReturnTo(path + request.nextUrl.search)});
  }

  if (user && (isLoginPage || isAppPath(path))) {
    const {data:profile} = await supabase.from('profiles').select('role').eq('id',user.id).single();
    if (!profile) return redirect('/access-denied');
    if (isLoginPage) return redirect(safeReturnTo(request.nextUrl.searchParams.get('next'), profile.role));
    if (!canAccessPath(path, profile.role)) return redirect('/access-denied');
  }

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
