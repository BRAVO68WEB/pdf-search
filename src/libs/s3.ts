import { ObjectCannedACL, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import { env } from "@/env";

/**
 * Uploader class to upload files to S3
 */
export class Uploader {
	private static _s3Client: S3Client;
	private static _s3Opts: { bucket: string };

	/**
	 * Constructor to initialize the S3 client
	 * @param bucket S3 bucket name
	 */
	constructor(bucket: string) {
		const options = {
			bucket,
		};
		Uploader._s3Opts = options;
		const s3ClientOpts: S3ClientConfig = {
			endpoint: env.R2_ENDPOINT,
			region: "apac",
			credentials: {
				accessKeyId: env.R2_ACCESS_KEY_ID,
				secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			},
		};
		const client = new S3Client(s3ClientOpts);
		Uploader._s3Client = client;
	}

	/**
	 * Upload file to S3
	 * @param entity File entity path to be uploaded
	 * @param id name of the file
	 * @param file File to be uploaded
	 * @param acl `public-read` or `private` access
	 */
	async uploadFile(entity: string, id: string, file: Blob | Buffer, acl: ObjectCannedACL) {
		const parallelUploads3 = new Upload({
			client: Uploader._s3Client,
			params: {
				Bucket: Uploader._s3Opts.bucket,
				ACL: acl,
				Body: file,
				Key: entity + "/" + id,
			},
		});

		await parallelUploads3.done();
	}
}
