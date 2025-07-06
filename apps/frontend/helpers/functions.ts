"use server";

import { cookies } from "next/headers";

/**
 * Get the authentication content string for cookies.
 *
 * @returns The authentication string.
 */
export async function getAuthContent(): Promise<string> {
	const cookieStore = await cookies();
	const tokenProd = cookieStore.get("__session")?.value;
	const tokenDev = cookieStore.get("__session")?.value;

	const sessionToken = tokenProd
		? `${tokenProd}`
		: `${tokenDev}`;

	return `Bearer ${sessionToken}`;
}
