// require('dotenv').config({ path: './env' })     this is the current way of import but down below you can  like that 
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: './env'
})
connectDB()




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