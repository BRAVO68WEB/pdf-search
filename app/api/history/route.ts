import { NextResponse } from "next/server";
import { DB } from "@/supabase/kysely";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const grade = searchParams.get("grade");

    if (!query || !grade) {
        return NextResponse.json({ error: "Missing query or grade" }, { status: 400 });
    }

    try {
        const db = await DB.getInstance();
        const data = await db.selectFrom("search_results")
            .select([
                'id',
                'query',
            ])
            .where("query", "like", `%${query}%`)
            .where("grade", "=", grade)
            .execute();

        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}