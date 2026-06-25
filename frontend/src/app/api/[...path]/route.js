import { NextResponse } from "next/server";

// Load backend base URL, defaulting to local instance
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Proxy helper function.
 * @param {string} method - HTTP method (GET, POST)
 * @param {string} path - sub-path parameters (e.g. ['clusters', 'abc'])
 * @param {URLSearchParams} searchParams - query string parameters
 * @param {object|null} body - request payload body
 */
async function handleProxy(method, path, searchParams, body = null) {
  const subPath = path.join("/");
  const queryString = searchParams.toString();
  const targetUrl = `${API_BASE_URL}/${subPath}${queryString ? "?" + queryString : ""}`;

  console.log(`[Proxy] Forwarding ${method} -> ${targetUrl}`);

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  try {
    const backendResponse = await fetch(targetUrl, options);
    
    // Check if the response is JSON
    const contentType = backendResponse.headers.get("content-type");
    let responseData;
    if (contentType && contentType.includes("application/json")) {
      responseData = await backendResponse.json();
    } else {
      responseData = { text: await backendResponse.text() };
    }

    return NextResponse.json(responseData, { status: backendResponse.status });
  } catch (error) {
    console.error(`[Proxy] Target ${targetUrl} failed:`, error.message);
    return NextResponse.json(
      { error: `Proxy connection error: ${error.message}` },
      { status: 502 } // Bad Gateway
    );
  }
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const searchParams = request.nextUrl.searchParams;
  return handleProxy("GET", path, searchParams);
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams.path;
  const searchParams = request.nextUrl.searchParams;
  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    // No body or empty
  }
  return handleProxy("POST", path, searchParams, body);
}
