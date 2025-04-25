import { NextResponse } from "next/server";
import { queryCSE } from "@/libs/cse";
import { DB } from "@/supabase/kysely";
import { v7 as uuidv7 } from "uuid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const grade = searchParams.get("grade");

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

    // fetch 20 search results from google
    const searchPromise = [
      queryCSE(query, grade, "1"),
      queryCSE(query, grade, "11"),
    ]
    const dataRaw = await Promise.all(searchPromise)

    // Flatten the array of arrays
    const data = dataRaw.flat();

    if(!data) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const dbEntry = await db.insertInto("search_results").values({
      id: uuidv7(),
      grade,
      query,
      results: JSON.stringify(data),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

    return NextResponse.json({
      ...dbEntry,
      results: data,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}