import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});



const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        //upload the file of cloudinary
        const res = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        //filehas been uploaded successfully
        // console.log('file is uploaded on cloudinary', res.url)
        fs.unlinkSync(localFilePath)           // remove image from locally form public temp folder after upload on cloudinary
        return res;
    } catch (error) {
        fs.unlinkSync(localFilePath)  //remove the localy save temporary file as the upload operation got failed
        return null;
    }
}


export { uploadOnCloudinary }
