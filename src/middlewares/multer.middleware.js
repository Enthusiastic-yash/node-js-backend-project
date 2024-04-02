import multer from "multer";

// multer is helping us to get images data from frontend  here first we save image on our temp file and then upload on cloudinary server
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

export const upload = multer(
    {
        storage,
    }
)