import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudianry = async (fileName: string) => {
  try {
    if (!fileName) return null;
    const response = await cloudinary.uploader.upload(fileName, {
      resource_type: "auto",
    });
    console.log("file uploaded on url: ", response.url);
    fs.unlinkSync(fileName);
    return response;
  } catch (error) {
    fs.unlinkSync(fileName);
    return null;
  }
};

export { uploadOnCloudianry };
