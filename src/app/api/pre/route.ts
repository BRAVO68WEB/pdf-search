import { NextResponse } from "next/server";
import { DB } from "@/db/kysely";
import { SearchResultType } from "@/types";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const search_result_id = searchParams.get("search_result_id");

	if (!search_result_id) {
		return NextResponse.json({ error: "Missing search_result_id" }, { status: 400 });
	}

	try {
		const db = await DB.getInstance();

		// Check if the query already exists in the database
		const parsedPdfs = await db
			.selectFrom("pdf_parsed")
			.selectAll()
			.where("search_result_id", "=", search_result_id)
			.execute();

		if (!parsedPdfs || parsedPdfs.length === 0) {
			return NextResponse.json(
				{
					error: "No data found",
				},
				{ status: 404 },
			);
		}

		const storedPdfs = await db
			.selectFrom("pdf_stores")
			.selectAll()
			.where(
				"id",
				"in",
				parsedPdfs.map(pdf => pdf.pdf_store_id),
			)
			.execute();

		if (!storedPdfs || storedPdfs.length === 0) {
			return NextResponse.json(
				{
					error: "No pdf store data found",
				},
				{ status: 404 },
			);
		}

		const data: SearchResultType[] = parsedPdfs
			.map(({ id, pdf_store_id, relevance }) => {
				const pdfStoreData = storedPdfs.find(pdf => pdf.id === pdf_store_id);

				if (!pdfStoreData) {
					return null;
				}

				return {
					id,
					title: pdfStoreData.title,
					description: pdfStoreData.description,
					image: pdfStoreData.thumbnail_url,
					totalPages: pdfStoreData.total_pages,
					relevantPages: JSON.parse(relevance),
				};
			})
			.filter(Boolean) as SearchResultType[];

		return NextResponse.json(data);
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
	}
}
