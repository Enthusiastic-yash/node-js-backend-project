import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";


export const verifyJWT = asyncHandler(async (req, res, next) => {
    // here we get accesstoken from req.cookies middleware but in mobile application we don't have option to get cokkies in app so we  use header where we replace bearer and space with empty string and we well get token
    // here we get accesstoken from frontend so can get the user and further we can logout
    try {
        // const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")  // or down below line
        const token = req.cookies?.accessToken || req.header("Authorization")?.split(" ")[1]
        console.log(token)
        if (!token) {
            throw new ApiError(401, "unauthorized request")
        }

        // here we check the the token we get is valid or not for that we use this method to check it
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)


        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user) {
            throw new ApiError(401, "invalid access token")
        }

        // here we add user in req so we can now have acces use that will help us to logout the user
        req.user = user

        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})