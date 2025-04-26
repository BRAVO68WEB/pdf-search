import { NextResponse } from "next/server";
import { DB } from "@/db/kysely";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const query = searchParams.get("query");
	const grade = searchParams.get("grade");

	if (!query || !grade) {
		return NextResponse.json({ error: "Missing query or grade" }, { status: 400 });
	}

	try {
		const db = await DB.getInstance();

		// Get unique queries that match the input
		const data = await db
			.selectFrom("search_results")
			.select(["id", "query", "created_at"])
			.where("query", "like", `%${query}%`)
			.where("grade", "=", grade)
			.orderBy("created_at", "desc")
			.limit(10)
			.execute();

		// Return unique queries
		const uniqueQueries = Array.from(new Map(data.map(item => [item.query, item])).values());

		return NextResponse.json(uniqueQueries);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
	}
}
