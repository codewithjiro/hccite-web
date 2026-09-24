import { generateUploadDropzone } from "@uploadthing/react";
import type { UploadRouter } from "~/server/studies/uploadthing";

export const UploadDropzone = generateUploadDropzone<UploadRouter>();
