// require('dotenv').config({ path: './env' })     this is the current way of import but down below you can  like that 
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js"

dotenv.config({
    path: './.env'
})
connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`server is running at port ${process.env.PORT}`);
        });
    })
    .catch((err) => {
        console.log('MONGODB DB Connection Failed : ', err)
    })




/*
(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on('Error', (error) => {
            console.log('Error : ', error)
            throw error;
        })

        app.listen(`${process.env.PORT}`, () => {
            console.log('app is listening on port ' + `${process.env.PORT}`)
        })

    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
})()
*/