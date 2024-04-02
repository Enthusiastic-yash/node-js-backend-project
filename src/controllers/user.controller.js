import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { response } from "express";

const registerUser = asyncHandler(async (req, res) => {
    // get user details form frontend
    //validation not empty
    //check if user is already exists
    //check for images , check for avatar
    //  upload them to cloudinary , avtar 
    // create user object - create entry in db
    // remove password and refresh token field from response
    //check for user creation 
    // return response

    const { userName, email, password, fullName } = req.body
    console.log("email: " + email)
    console.log("userName : " + userName)
    console.log("password : " + password)
    console.log("fullname : " + fullName)

    if ([userName, email, password, fullName].some((filed) => filed?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
        // we can further check  is there is @ preset in email or not or you can create a seprate file for all the validation and check every ther 
    }
    const existedUSer = User.findOne({
        $or: [{ userName }, { email }]
    })

    if (existedUSer) {
        throw new ApiError(409, 'User with email and username already exists')
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user Register successfully")
    )
})


export { registerUser }