import { NextResponse } from "next/server";
import { queryCSE } from "@/libs/cse";
import { DB } from "@/supabase/kysely";
import { v7 as uuidv7 } from "uuid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const grade = searchParams.get("grade");

  const startIndex = searchParams.get("startIndex") ?? "1";

  if (!query || !grade) {
    return NextResponse.json({ error: "Missing query or grade" }, { status: 400 });
  }

  try {
    const db = await DB.getInstance();

    // Check if the query already exists in the database
    const existingData = await db.selectFrom("search_results")
      .selectAll()
      .where("query", "=", query)
      .where("grade", "=", grade)
      .executeTakeFirst();

    if (existingData) {
      return NextResponse.json({
        ...existingData,
        results: JSON.parse(existingData.results),
      });
    }

    const data = await queryCSE(query, grade, startIndex);

    if(!data?.items) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const dbEntry = await db.insertInto("search_results").values({
      id: uuidv7(),
      grade,
      query,
      results: JSON.stringify(data.items),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

    return NextResponse.json({
      ...dbEntry,
      results: data.items,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}