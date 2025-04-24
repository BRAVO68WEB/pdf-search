// Code Ref: https://github.com/bangbang93/node-pdf-extract-image/blob/master/src/index.ts

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import {getDocument, OPS} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {PNG} from 'pngjs'

pdfjs.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js';


export async function extractImagesFromPdf(pdfPath: string | ArrayBuffer): Promise<{
    page_no: number,
    image: Buffer
}[]> {
  const loadingTask = getDocument(pdfPath)
  const pdf = await loadingTask.promise

  const numPages = pdf.numPages
  const images: {
    page_no: number;
    image: Buffer;
  }[] = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const ops = await page.getOperatorList()

    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === OPS.paintImageXObject) {
        const args = ops.argsArray[j] as unknown[]
        const imgName = args[0] as string
        const imgObj = page.objs.get(imgName) as NodeJS.Dict<unknown>
        const {width, height, data: imgData} = imgObj
        if (!(imgData instanceof Uint8ClampedArray) || typeof width !== 'number' || typeof height !== 'number') continue
        const png = new PNG({width, height})
        png.data = Buffer.from(new Uint8Array(rgbToRgba(imgData).buffer))
        images.push({
            page_no: i,
            image: PNG.sync.write(png)
        })
      }
    }
  }
  return images
}

function rgbToRgba(imgData: Uint8ClampedArray): Uint8ClampedArray {
  const rgbaData = new Uint8ClampedArray((imgData.length / 3) * 4)
  for (let i = 0; i < imgData.length; i += 3) {
    rgbaData[(i * 4) / 3] = imgData[i]
    rgbaData[(i * 4) / 3 + 1] = imgData[i + 1]
    rgbaData[(i * 4) / 3 + 2] = imgData[i + 2]
    rgbaData[(i * 4) / 3 + 3] = 255
  }
  return rgbaData
}