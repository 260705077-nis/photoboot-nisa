import { handleRoute, jsonResponse } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  return handleRoute(async () => {
    const user = await getCurrentUser();
    return jsonResponse({ data: user });
  });
}
