import { NextResponse } from "next/server";

export async function GET() {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return NextResponse.json({ message: "Hello, world!" }, { headers });}