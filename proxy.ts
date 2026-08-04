import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if(!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if(request.nextUrl.pathname.startsWith("/dashboard/control-plane/server")) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"], 
};