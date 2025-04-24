// create a function which takes input of a pdf url, downloads it and upload to s3 bucket

import { Uploader } from "./s3"

import { env } from "@/env"

export const downloadPdf = async (url: string) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "blob"; // Set the response type to 'blob' to handle binary data

        xhr.onload = async () => {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const fileName = url.split("/").pop() ?? Date.now() + ".pdf";
                const uploader = new Uploader(env.R2_BUCKET_NAME);
                await uploader.uploadFile("pdfs", fileName, blob, "public-read");
                resolve(`${env.R2_ENDPOINT}/${fileName}`);
            } else {
                reject(new Error(`Failed to download PDF: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error("Network error while downloading PDF"));
        };

        xhr.send();
    });
}
